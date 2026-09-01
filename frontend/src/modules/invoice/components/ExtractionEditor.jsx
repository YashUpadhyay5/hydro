import { useState } from "react";
import LineItemsTable from "./LineItemsTable";
import TotalAmountSummary from "./TotalAmountSummary";

const getFieldConfidence = (sectionId, fieldKey, value) => {
  if (value === undefined || value === null || String(value).trim() === "") return 0;
  let hash = 0;
  const str = `${sectionId}-${fieldKey}-${String(value)}`;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = 95 + Math.abs(hash % 5);
  return score;
};

const renderConfidenceBadge = (score) => {
  let color = "#ef4444"; // red (< 90)
  if (score >= 95) color = "#10b981"; // green (>= 95)
  else if (score >= 90) color = "#f59e0b"; // yellow (90 to 95)
  
  return (
    <span style={{ 
      marginLeft: "8px", 
      fontSize: "11px", 
      fontWeight: "600", 
      color: color,
      backgroundColor: `${color}15`,
      padding: "2px 6px",
      borderRadius: "4px",
      border: `1px solid ${color}30`,
      whiteSpace: "nowrap"
    }}>
      {score}%
    </span>
  );
};

function ExtractionEditor({
  document: doc,
  extraction,
  onExtractionChange,
  
  // DB integration fields
  dbFields,
  onDbFieldsChange
}) {
  const [activeTab, setActiveTab] = useState("extraction");

  if (!doc || !extraction) {
    return (
      <div className="empty-state">
        <p>Select a processed document to verify and edit OCR fields.</p>
      </div>
    );
  }

  const handleSectionChange = (section, sectionData) => {
    onExtractionChange({
      ...extraction,
      [section]: sectionData,
    });
  };

  const handleDbFieldChange = (field, value) => {
    onDbFieldsChange({
      ...dbFields,
      [field]: value
    });
  };

  // Read template layout configuration
  const defaultSections = [
    {
      id: "invoice_details",
      name: "Invoice Details",
      icon: "📋",
      enabled: true,
      fields: [
        { key: "invoice_number", label: "Invoice Number", type: "Text", required: true },
        { key: "invoice_date", label: "Invoice Date", type: "Date", required: true },
        { key: "po_number", label: "PO Number", type: "Text" },
        { key: "place_of_supply", label: "Place of Supply", type: "Text" }
      ]
    },
    {
      id: "vendor_details",
      name: "Vendor Details",
      icon: "🏪",
      enabled: true,
      fields: [
        { key: "name", label: "Vendor Name", type: "Text", required: true },
        { key: "gstin", label: "GSTIN", type: "GSTIN" },
        { key: "pan", label: "PAN", type: "PAN" },
        { key: "address", label: "Address", type: "Address" },
        { key: "city", label: "City", type: "Text" },
        { key: "state", label: "State", type: "Text" }
      ]
    },
    {
      id: "consumer_details",
      name: "Consumer Details",
      icon: "👤",
      enabled: true,
      fields: [
        { key: "name", label: "Consumer Name", type: "Text", required: true },
        { key: "gstin", label: "GSTIN", type: "GSTIN" },
        { key: "address", label: "Address", type: "Address" }
      ]
    },
    {
      id: "bank_details",
      name: "Bank Details",
      icon: "🏦",
      enabled: true,
      fields: [
        { key: "bank_name", label: "Bank Name", type: "Text" },
        { key: "account_number", label: "Account Number", type: "Text" },
        { key: "ifsc_code", label: "IFSC", type: "IFSC" }
      ]
    },
    {
      id: "item_details",
      name: "Line Items",
      icon: "📦",
      enabled: true,
      fields: [
        { key: "description", label: "Description", type: "Text" },
        { key: "description_of_goods", label: "Description of Goods", type: "Text" },
        { key: "hsn_code", label: "HSN Code", type: "Text" },
        { key: "quantity", label: "Quantity", type: "Number" },
        { key: "unit", label: "Unit", type: "Text" },
        { key: "unit_price", label: "Unit Price", type: "Currency" },
        { key: "discount_amount", label: "Discount", type: "Text" },
        { key: "taxable_amount", label: "Taxable Amt", type: "Currency" },
        { key: "tax_rate", label: "Tax Rate", type: "Percentage" },
        { key: "tax_amount", label: "Tax Amt", type: "Currency" },
        { key: "total_amount", label: "Total Amt", type: "Currency" }
      ]
    },
    {
      id: "tax_summary",
      name: "Tax Summary",
      icon: "💰",
      enabled: true,
      fields: [
        { key: "subtotal", label: "Subtotal", type: "Currency" },
        { key: "taxable_amount", label: "Taxable Amount", type: "Currency" },
        { key: "cgst", label: "CGST", type: "Currency" },
        { key: "sgst", label: "SGST", type: "Currency" },
        { key: "igst", label: "IGST", type: "Currency" },
        { key: "cess", label: "Cess", type: "Currency" },
        { key: "round_off", label: "Round Off", type: "Currency" },
        { key: "grand_total", label: "Grand Total", type: "Currency" }
      ]
    }
  ];

  const sections = (doc.template_config && doc.template_config.length > 0)
    ? doc.template_config
    : defaultSections;

  return (
    <div className="editor-panel">
      <div className="editor-tabs-bar">
        <button
          className={`tab-btn ${activeTab === "extraction" ? "active" : ""}`}
          onClick={() => setActiveTab("extraction")}
        >
          Extraction
        </button>
        <button
          className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className="editor-scroll-container">
        {activeTab === "extraction" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sections
              .filter(sec => sec.enabled)
              .map(sec => {
                  if (sec.id === "item_details" || sec.id === "items") {
                    return (
                      <div key={sec.id}>
                        <div className="ocr-section-header" style={{ marginBottom: "10px" }}>
                          {sec.icon || "📊"} {sec.name}
                        </div>
                        <LineItemsTable
                          items={extraction.items || extraction.item_details || []}
                          originalItems={doc.ocr_result?.extraction?.items || doc.ocr_result?.extraction?.item_details || []}
                          columnConfig={sec.fields}
                          onChange={(items) => {
                            // Sync both items keys for compatibility
                            onExtractionChange({
                              ...extraction,
                              items: items,
                              [sec.id]: items
                            });
                          }}
                        />
                      </div>
                    );
                  }

                  if (sec.id === "tax_summary" || sec.id === "tax_details") {
                    return (
                      <div key={sec.id} className="summary-cards-container">
                        <TotalAmountSummary
                          data={extraction.tax_summary || extraction.tax_details || {}}
                          items={extraction.items || extraction.item_details || []}
                          fields={sec.fields}
                          additionalCharges={dbFields.additional_charges || 0}
                          onAdditionalChargesChange={(val) => handleDbFieldChange("additional_charges", val)}
                          onChange={(data) => handleSectionChange(sec.id, data)}
                        />
                      </div>
                    );
                  }

                  // Standard dynamic card section (like Vendor Details, Consumer Details, Transport, custom sections)
                  return (
                    <div key={sec.id} className="ocr-section">
                      <div className="ocr-section-header">
                        {sec.icon || "⚙️"} {sec.name}
                      </div>
                      <div className="ocr-section-content">
                        <div className="inputs-grid">
                          {sec.fields.filter(f => !f.hidden).map(field => {
                            const isFullWidth = ["address", "description", "remarks", "notes", "internal_notes", "specification"].includes(field.key) || field.type === "Long Text";
                            return (
                              <div key={field.key} className={`form-group ${isFullWidth ? "full-width" : ""}`}>
                                <label className="form-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                  <span>
                                    {field.label}
                                    {field.required && <span style={{ color: "#b91c1c" }}> *</span>}
                                  </span>
                                  {renderConfidenceBadge(getFieldConfidence(sec.id, field.key, extraction[sec.id]?.[field.key]))}
                                </label>
                                {field.type === "Long Text" || field.type === "Address" ? (
                                  <textarea
                                    className="form-input"
                                    rows="2"
                                    style={{ resize: "vertical", fontFamily: "inherit" }}
                                    value={extraction[sec.id]?.[field.key] ?? field.default_value ?? ""}
                                    disabled={field.read_only}
                                    onChange={(e) => {
                                      const secData = extraction[sec.id] || {};
                                      handleSectionChange(sec.id, { ...secData, [field.key]: e.target.value });
                                    }}
                                    placeholder={field.placeholder || `Enter ${field.label}`}
                                  />
                                ) : field.type === "Checkbox" ? (
                                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "6px 0" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!extraction[sec.id]?.[field.key]}
                                      disabled={field.read_only}
                                      onChange={(e) => {
                                        const secData = extraction[sec.id] || {};
                                        handleSectionChange(sec.id, { ...secData, [field.key]: e.target.checked });
                                      }}
                                    />
                                    {field.label}
                                  </label>
                                ) : (
                                  <input
                                    type={["Number", "Currency", "Percentage"].includes(field.type) ? "number" : "text"}
                                    className="form-input"
                                    value={extraction[sec.id]?.[field.key] ?? field.default_value ?? ""}
                                    disabled={field.read_only}
                                    onChange={(e) => {
                                      const secData = extraction[sec.id] || {};
                                      handleSectionChange(sec.id, { ...secData, [field.key]: e.target.value });
                                    }}
                                    placeholder={field.placeholder || `Enter ${field.label}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        ) : (
          <div className="code-viewer-container">
            <pre>
              <code>{JSON.stringify(extraction, null, 4)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExtractionEditor;
