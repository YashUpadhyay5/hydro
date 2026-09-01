import os
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


class ExcelService:

    @staticmethod
    def generate_inventory_excel(db: Session):
        # 1. Fetch active template
        tpl = db.query(Template).filter(Template.is_default == True).first()
        if not tpl:
            tpl = db.query(Template).first()
            
        if not tpl:
            from routes.templates import get_default_template_sections
            sections = get_default_template_sections()
        else:
            sections = tpl.sections

        # 2. Get enabled fields list
        columns_mapping = []
        items_section_id = "item_details"

        for sec in sections:
            if not sec.get("enabled", True):
                continue
            sec_id = sec["id"]
            if sec_id in ["item_details", "items"]:
                items_section_id = sec_id
                for field in sec.get("fields", []):
                    if not field.get("hidden", False):
                        columns_mapping.append((sec_id, field["key"], f"Item - {field['label']}", field.get("type", "Text")))
            else:
                for field in sec.get("fields", []):
                    if not field.get("hidden", False):
                        columns_mapping.append((sec_id, field["key"], f"{sec['name']} - {field['label']}", field.get("type", "Text")))

        # 3. Query all processed queue documents containing ocr extraction data
        docs = db.query(QueueDocument).filter(
            QueueDocument.ocr_result.isnot(None)
        ).all()

        rows = []
        total_qty = 0.0
        total_value = 0.0
        total_tax = 0.0
        total_records_count = 0
        unique_vendors = set()

        for doc in docs:
            ext = doc.final_extraction or (doc.ocr_result.get("extraction") if doc.ocr_result else {}) or {}
            
            # Extract line items
            items_list = ext.get(items_section_id, ext.get("items", [])) or []
            if not isinstance(items_list, list):
                items_list = []
                
            if not items_list:
                items_list = [{}]

            # Track metrics
            vendor_details = ext.get("vendor_details", {}) or {}
            v_name = vendor_details.get("name", "")
            if v_name:
                unique_vendors.add(v_name)

            for item in items_list:
                row_dict = {}
                item_qty = 0.0
                item_total = 0.0
                
                for sec_id, f_key, col_header, f_type in columns_mapping:
                    if sec_id in ["item_details", "items"]:
                        val = item.get(f_key, "")
                        if f_key == "quantity":
                            item_qty = safe_float(val)
                        if f_key == "total_amount":
                            item_total = safe_float(val)
                    else:
                        sec_val = ext.get(sec_id, {}) or {}
                        val = sec_val.get(f_key, "") if isinstance(sec_val, dict) else ""
                    
                    row_dict[col_header] = val
                
                rows.append(row_dict)
                total_qty += item_qty
                total_value += item_total
                total_records_count += 1

        for doc in docs:
            ext = doc.final_extraction or (doc.ocr_result.get("extraction") if doc.ocr_result else {}) or {}
            tax_sum = ext.get("tax_summary", {}) or {}
            cgst = safe_float(tax_sum.get("cgst") or tax_sum.get("cgst_amount"))
            sgst = safe_float(tax_sum.get("sgst") or tax_sum.get("sgst_amount"))
            igst = safe_float(tax_sum.get("igst") or tax_sum.get("igst_amount"))
            total_tax += (cgst + sgst + igst)

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
                    "Value": total_qty
                },
                {
                    "Metric": "Total Tax Amount",
                    "Value": total_tax
                },
                {
                    "Metric": "Total Inventory Value",
                    "Value": total_value
                }
            ])

            summary_df.to_excel(
                writer,
                sheet_name="Summary",
                index=False
            )

        return export_path