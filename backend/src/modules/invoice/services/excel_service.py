import os
import re
import pandas as pd
from sqlalchemy.orm import Session
from config import Config
from models.queue_document import QueueDocument
from models.template import Template

def safe_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().lower()
    if val_str in ("", "null", "none", "nan", "undefined", "n/a", "-"):
        return default
    clean_str = val_str.replace(",", "").replace(" ", "").replace("₹", "").replace("$", "")
    try:
        return float(clean_str)
    except (ValueError, TypeError):
        return default

def parse_numeric(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(",", "").replace("₹", "").replace("$", "")
    match = re.search(r"[-+]?\d*\.?\d+", val_str)
    if match:
        try:
            return float(match.group(0))
        except:
            return 0.0
    return 0.0


class ExcelService:

    @staticmethod
    def generate_inventory_excel(db: Session, start_date: str = None, end_date: str = None):
        # 1. Fetch active template
        tpl = db.query(Template).filter(Template.is_default == True).first()
        if not tpl:
            tpl = db.query(Template).first()
            
        if not tpl:
            from routes.templates import get_default_template_sections
            sections = get_default_template_sections()
        else:
            sections = tpl.sections

        # 2. Build column mapping from template sections
        columns_mapping = []
        items_section_id = "item_details"

        # Track whether item subtotal/tax columns are explicitly generated
        has_custom_item_cols = False

        for sec in sections:
            if not sec.get("enabled", True):
                continue
            sec_id = sec["id"]
            if sec_id in ["item_details", "items"]:
                items_section_id = sec_id
                for field in sec.get("fields", []):
                    if not field.get("hidden", False):
                        f_key = field["key"]
                        col_label = f"Item - {field['label']}"
                        columns_mapping.append((sec_id, f_key, col_label, field.get("type", "Text")))
                        
                        # Inject row-level computed columns right after unit_price
                        if f_key == "unit_price":
                            columns_mapping.append((sec_id, "computed_subtotal", "Item - Subtotal (Qty × Rate)", "Currency"))
                            columns_mapping.append((sec_id, "computed_cgst", "Item - CGST", "Currency"))
                            columns_mapping.append((sec_id, "computed_sgst", "Item - SGST", "Currency"))
                            columns_mapping.append((sec_id, "computed_igst", "Item - IGST", "Currency"))
                            columns_mapping.append((sec_id, "computed_total_tax", "Item - Total Tax", "Currency"))
                            has_custom_item_cols = True
            else:
                for field in sec.get("fields", []):
                    if not field.get("hidden", False):
                        columns_mapping.append((sec_id, field["key"], f"{sec['name']} - {field['label']}", field.get("type", "Text")))

        # 3. Query processed queue documents containing ocr extraction data with optional uploaded date duration filter
        query = db.query(QueueDocument).filter(
            QueueDocument.ocr_result.isnot(None)
        )
        if start_date:
            query = query.filter(QueueDocument.created_at >= f"{start_date.strip()} 00:00:00")
        if end_date:
            query = query.filter(QueueDocument.created_at <= f"{end_date.strip()} 23:59:59")

        docs = query.order_by(QueueDocument.created_at.desc()).all()

        rows = []
        total_qty = 0.0
        total_value = 0.0
        total_tax = 0.0
        total_records_count = 0
        unique_vendors = set()

        for doc in docs:
            ext = doc.final_extraction or (doc.ocr_result.get("extraction") if doc.ocr_result else {}) or {}
            ext = ext or {}

            # Invoice-level tax summary
            tax_sum = ext.get("tax_summary", {}) or {}
            inv_subtotal = safe_float(tax_sum.get("subtotal") or tax_sum.get("taxable_amount"))
            inv_cgst = safe_float(tax_sum.get("cgst") or tax_sum.get("cgst_amount"))
            inv_sgst = safe_float(tax_sum.get("sgst") or tax_sum.get("sgst_amount"))
            inv_igst = safe_float(tax_sum.get("igst") or tax_sum.get("igst_amount"))
            inv_grand_total = safe_float(tax_sum.get("grand_total") or tax_sum.get("calculated_grand_total"))

            # Track unique vendors
            vendor_details = ext.get("vendor_details", {}) or {}
            v_name = vendor_details.get("name", "")
            if v_name:
                unique_vendors.add(v_name)

            # Extract line items
            items_list = ext.get(items_section_id, ext.get("items", [])) or []
            if not isinstance(items_list, list) or len(items_list) == 0:
                items_list = [{}]

            total_items_in_doc = len(items_list)

            for item_idx, item in enumerate(items_list):
                if not isinstance(item, dict):
                    item = {}
                is_last_item = (item_idx == total_items_in_doc - 1)

                # 1. Parse quantity and price
                raw_qty = item.get("quantity", "")
                raw_price = item.get("unit_price", "")
                qty_num = parse_numeric(raw_qty)
                price_num = parse_numeric(raw_price)

                # 2. Compute Item Subtotal
                extracted_item_subtotal = safe_float(item.get("taxable_amount"))
                extracted_item_total = safe_float(item.get("total_amount") or item.get("amount"))

                # OCR trailing zero correction (e.g. 2400.000 NOS -> 2400000.0 vs taxable 235200 with unit price 98)
                if qty_num > 0 and price_num > 0 and extracted_item_subtotal > 0:
                    computed_raw = qty_num * price_num
                    if abs(computed_raw - extracted_item_subtotal * 1000) < 1.0:
                        qty_num = round(qty_num / 1000.0, 3)

                if extracted_item_subtotal > 0:
                    item_subtotal = extracted_item_subtotal
                elif qty_num > 0 and price_num > 0:
                    item_subtotal = round(qty_num * price_num, 2)
                else:
                    item_subtotal = safe_float(item.get("total_amount", 0.0))

                # 3. Compute Item GST (CGST, SGST, IGST)
                if "cgst_amount" in item or "sgst_amount" in item or "igst_amount" in item:
                    item_cgst = safe_float(item.get("cgst_amount"))
                    item_sgst = safe_float(item.get("sgst_amount"))
                    item_igst = safe_float(item.get("igst_amount"))
                else:
                    raw_item_tax = safe_float(item.get("tax_amount"))
                    if raw_item_tax == 0.0 and "tax_rate" in item:
                        item_rate = parse_numeric(item.get("tax_rate"))
                        if item_rate > 0:
                            raw_item_tax = round(item_subtotal * (item_rate / 100.0), 2)
                    
                    if inv_igst > 0:
                        item_cgst = 0.0
                        item_sgst = 0.0
                        item_igst = raw_item_tax
                    else:
                        item_cgst = round(raw_item_tax / 2.0, 2)
                        item_sgst = round(raw_item_tax / 2.0, 2)
                        item_igst = 0.0

                item_total_tax = round(item_cgst + item_sgst + item_igst, 2)
                if extracted_item_total > 0:
                    item_total = extracted_item_total
                elif item_subtotal > 0:
                    item_total = round(item_subtotal + item_total_tax, 2)
                else:
                    item_total = 0.0

                # 4. Construct Row dictionary
                row_dict = {}
                for sec_id, f_key, col_header, f_type in columns_mapping:
                    if sec_id in ["item_details", "items"]:
                        if f_key == "computed_subtotal" or f_key == "subtotal":
                            val = item_subtotal
                        elif f_key == "computed_cgst" or f_key == "cgst":
                            val = item_cgst
                        elif f_key == "computed_sgst" or f_key == "sgst":
                            val = item_sgst
                        elif f_key == "computed_igst" or f_key == "igst":
                            val = item_igst
                        elif f_key == "computed_total_tax" or f_key == "tax_amount":
                            val = item_total_tax
                        elif f_key == "total_amount":
                            val = item_total
                        elif f_key == "taxable_amount":
                            val = item_subtotal
                        else:
                            val = item.get(f_key, "")
                    elif sec_id in ["tax_summary", "tax_details"]:
                        # Invoice level totals are ONLY shown on the last row of the invoice
                        if is_last_item:
                            sec_val = ext.get(sec_id, {}) or {}
                            if f_key == "subtotal" or f_key == "taxable_amount":
                                val = inv_subtotal
                            elif f_key == "cgst":
                                val = inv_cgst
                            elif f_key == "sgst":
                                val = inv_sgst
                            elif f_key == "igst":
                                val = inv_igst
                            elif f_key == "grand_total":
                                val = inv_grand_total
                            else:
                                val = sec_val.get(f_key, "") if isinstance(sec_val, dict) else ""
                        else:
                            val = ""
                    else:
                        sec_val = ext.get(sec_id, {}) or {}
                        val = sec_val.get(f_key, "") if isinstance(sec_val, dict) else ""
                    
                    row_dict[col_header] = val
                
                rows.append(row_dict)
                total_qty += qty_num
                total_value += item_total
                total_records_count += 1

        total_taxable_subtotal = 0.0
        total_cgst_sum = 0.0
        total_sgst_sum = 0.0
        total_igst_sum = 0.0
        total_cess_sum = 0.0
        total_grand_total_sum = 0.0

        for doc in docs:
            ext = doc.final_extraction or (doc.ocr_result.get("extraction") if doc.ocr_result else {}) or {}
            tax_sum = ext.get("tax_summary", {}) or {}
            subtotal = safe_float(tax_sum.get("subtotal") or tax_sum.get("taxable_amount"))
            cgst = safe_float(tax_sum.get("cgst") or tax_sum.get("cgst_amount"))
            sgst = safe_float(tax_sum.get("sgst") or tax_sum.get("sgst_amount"))
            igst = safe_float(tax_sum.get("igst") or tax_sum.get("igst_amount"))
            cess = safe_float(tax_sum.get("cess") or tax_sum.get("cess_amount"))
            gt = safe_float(tax_sum.get("grand_total") or tax_sum.get("calculated_grand_total"))

            if gt == 0.0 and subtotal > 0:
                gt = subtotal + cgst + sgst + igst + cess

            total_taxable_subtotal += subtotal
            total_cgst_sum += cgst
            total_sgst_sum += sgst
            total_igst_sum += igst
            total_cess_sum += cess
            total_grand_total_sum += gt

        total_tax_sum = total_cgst_sum + total_sgst_sum + total_igst_sum + total_cess_sum

        export_path = os.path.join(
            Config.EXPORT_DIR,
            "inventory_export.xlsx"
        )
        
        if not rows:
            headers = [col[2] for col in columns_mapping] if columns_mapping else ["No Data"]
            df = pd.DataFrame(columns=headers)
        else:
            df = pd.DataFrame(rows)

        with pd.ExcelWriter(
            export_path,
            engine="xlsxwriter"
        ) as writer:
            df.to_excel(
                writer,
                sheet_name="Inventory Records",
                index=False
            )

            # Auto-fit column widths
            workbook = writer.book
            worksheet = writer.sheets["Inventory Records"]
            for i, col in enumerate(df.columns):
                val_lens = [len(str(v)) for v in df[col].values if v is not None and v != ""]
                max_len = max(val_lens + [len(str(col))]) + 3 if val_lens else len(str(col)) + 3
                worksheet.set_column(i, i, min(max(max_len, 10), 50))

            summary_df = pd.DataFrame([
                {
                    "Metric": "Total Documents",
                    "Value": len(docs)
                },
                {
                    "Metric": "Total Line Items",
                    "Value": total_records_count
                },
                {
                    "Metric": "Total Vendors",
                    "Value": len(unique_vendors)
                },
                {
                    "Metric": "Total Quantity",
                    "Value": round(total_qty, 2)
                },
                {
                    "Metric": "Total Taxable Amount (Subtotal)",
                    "Value": round(total_taxable_subtotal, 2)
                },
                {
                    "Metric": "Total CGST",
                    "Value": round(total_cgst_sum, 2)
                },
                {
                    "Metric": "Total SGST",
                    "Value": round(total_sgst_sum, 2)
                },
                {
                    "Metric": "Total IGST",
                    "Value": round(total_igst_sum, 2)
                },
                {
                    "Metric": "Total Cess",
                    "Value": round(total_cess_sum, 2)
                },
                {
                    "Metric": "Total Tax Amount",
                    "Value": round(total_tax_sum, 2)
                },
                {
                    "Metric": "Total Grand Total",
                    "Value": round(total_grand_total_sum, 2)
                }
            ])

            summary_df.to_excel(
                writer,
                sheet_name="Summary",
                index=False
            )

            summary_ws = writer.sheets["Summary"]
            summary_ws.set_column(0, 0, 35)
            summary_ws.set_column(1, 1, 20)

        return export_path