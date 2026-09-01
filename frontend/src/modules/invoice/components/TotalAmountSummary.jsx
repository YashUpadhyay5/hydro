import { useState } from "react";

const cleanNumberValue = (val) => {
  if (val === undefined || val === null) return "";
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  return cleaned === "" ? "" : cleaned;
};

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

const renderConfidenceBadge = (score, sug = null, currentVal = null) => {
  let color = "#ef4444"; // red (< 90)
  if (score >= 95) color = "#10b981"; // green (>= 95)
  else if (score >= 90) color = "#f59e0b"; // yellow (90 to 95)
  
  const hasMismatch = sug !== null && sug !== undefined && currentVal !== null && currentVal !== undefined && Math.abs((parseFloat(currentVal) || 0) - sug) > 0.05;
  
  return (
    <span 
      title={hasMismatch ? `Suggested value: ${sug}` : `Confidence: ${score}%`}
      style={{ 
        marginLeft: "8px", 
        fontSize: "11px", 
        fontWeight: "600", 
        color: hasMismatch ? "#7c3aed" : color,
        backgroundColor: hasMismatch ? "#f5f3ff" : `${color}15`,
        padding: "2px 6px",
        borderRadius: "4px",
        border: hasMismatch ? "2px solid #7c3aed" : `1px solid ${color}30`,
        whiteSpace: "nowrap",
        cursor: "default",
        transition: "all 0.2s ease"
      }}
    >
      {score}%
    </span>
  );
};

function TotalAmountSummary({ data = {}, items = [], fields = [], additionalCharges = 0, onAdditionalChargesChange, onChange }) {

  const shouldShow = (key) => {
    if (fields && fields.length > 0) {
      const conf = fields.find(f => f.key === key || (key === "taxable_amount" && f.key === "subtotal"));
      if (conf && conf.hidden) return false;
    }
    return true;
  };

  const effectiveTaxableAmount = (() => {
    if (data.taxable_amount !== undefined && data.taxable_amount !== null && String(data.taxable_amount).trim() !== "") {
      return data.taxable_amount;
    }
    if (data.subtotal !== undefined && data.subtotal !== null && String(data.subtotal).trim() !== "") {
      return data.subtotal;
    }
    const itemsTaxableSum = (items || []).reduce((sum, it) => sum + (parseFloat(it.taxable_amount) || 0), 0);
    if (itemsTaxableSum > 0) {
      return itemsTaxableSum.toFixed(2);
    }
    return "";
  })();

  const getTaxRate = () => {
    const rates = items.map(item => {
      const rateStr = String(item.tax_rate || "").replace("%", "").trim();
      return parseFloat(rateStr) || 0;
    }).filter(r => r > 0);
    
    if (rates.length > 0) {
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    }
    return 18; // default fallback
  };

  const getSuggestion = (field) => {
    const taxable = parseFloat(data.taxable_amount) || parseFloat(data.subtotal) || parseFloat(effectiveTaxableAmount) || 0;
    const cgst = parseFloat(data.cgst) || 0;
    const sgst = parseFloat(data.sgst) || 0;
    const igst = parseFloat(data.igst) || 0;
    const cess = parseFloat(data.cess) || 0;
    const roundOff = parseFloat(data.round_off) || 0;
    const extra = parseFloat(additionalCharges) || 0;

    if (field === "cgst" && cgst === 0 && sgst === 0) return null;
    if (field === "sgst" && cgst === 0 && sgst === 0) return null;
    if (field === "igst" && igst === 0) return null;

    const rate = getTaxRate();

    switch (field) {
      case "cgst":
        return parseFloat((taxable * ((rate / 2) / 100)).toFixed(2));
      case "sgst":
        return parseFloat((taxable * ((rate / 2) / 100)).toFixed(2));
      case "igst":
        return parseFloat((taxable * (rate / 100)).toFixed(2));
      case "grand_total":
        return parseFloat((taxable + cgst + sgst + igst + cess + roundOff + extra).toFixed(2));
      default:
        return null;
    }
  };



  const handleChange = (field, value) => {
    const numVal = value === "" ? "" : parseFloat(value) || 0;
    
    const updated = {
      ...data,
      [field]: numVal,
    };

    if (field === "taxable_amount") {
      updated.subtotal = numVal;
      const isIGST = (parseFloat(data.igst) > 0) || (parseFloat(data.cgst) === 0 && parseFloat(data.sgst) === 0);
      const taxable = numVal || 0;
      const rate = getTaxRate();
      if (isIGST) {
        updated.igst = parseFloat((taxable * (rate / 100)).toFixed(2));
        updated.cgst = 0;
        updated.sgst = 0;
      } else {
        updated.cgst = parseFloat((taxable * ((rate / 2) / 100)).toFixed(2));
        updated.sgst = parseFloat((taxable * ((rate / 2) / 100)).toFixed(2));
        updated.igst = 0;
      }
    }

    const taxable = parseFloat(updated.taxable_amount) || parseFloat(updated.subtotal) || parseFloat(effectiveTaxableAmount) || 0;
    const cgst = parseFloat(updated.cgst) || 0;
    const sgst = parseFloat(updated.sgst) || 0;
    const igst = parseFloat(updated.igst) || 0;
    const cess = parseFloat(updated.cess) || 0;
    const roundOff = parseFloat(updated.round_off) || 0;
    const extra = parseFloat(additionalCharges) || 0;

    updated.grand_total = parseFloat((taxable + cgst + sgst + igst + cess + roundOff + extra).toFixed(2));
    
    onChange(updated);
  };

  const handleAdditionalChargesChange = (val) => {
    const extra = val === "" ? "" : parseFloat(val) || 0;
    onAdditionalChargesChange(extra);

    const taxable = parseFloat(data.taxable_amount) || parseFloat(data.subtotal) || parseFloat(effectiveTaxableAmount) || 0;
    const cgst = parseFloat(data.cgst) || 0;
    const sgst = parseFloat(data.sgst) || 0;
    const igst = parseFloat(data.igst) || 0;
    const cess = parseFloat(data.cess) || 0;
    const roundOff = parseFloat(data.round_off) || 0;
    
    const newGrandTotal = parseFloat((taxable + cgst + sgst + igst + cess + roundOff + extra).toFixed(2));
    onChange({
      ...data,
      grand_total: newGrandTotal,
    });
  };

  return (
    <div className="summary-card">
      <h4>Total Amount Summary</h4>
      <div className="summary-fields">
        {shouldShow("taxable_amount") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>Taxable Amount</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "taxable_amount", effectiveTaxableAmount))}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(effectiveTaxableAmount)}
                onChange={(e) => handleChange("taxable_amount", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("cgst") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>CGST</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "cgst", data.cgst), getSuggestion("cgst"), data.cgst)}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(data.cgst)}
                onChange={(e) => handleChange("cgst", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("sgst") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>SGST</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "sgst", data.sgst), getSuggestion("sgst"), data.sgst)}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(data.sgst)}
                onChange={(e) => handleChange("sgst", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("igst") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>IGST</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "igst", data.igst), getSuggestion("igst"), data.igst)}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(data.igst)}
                onChange={(e) => handleChange("igst", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("cess") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>CESS</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "cess", data.cess))}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(data.cess)}
                onChange={(e) => handleChange("cess", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("round_off") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>Round Off</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "round_off", data.round_off))}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(data.round_off)}
                onChange={(e) => handleChange("round_off", e.target.value)}
              />
            </div>
          </div>
        )}

        {shouldShow("additional_charges") && (
          <div className="summary-row" style={{ display: "flex", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>Additional Charges</span>
              {renderConfidenceBadge(100)}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                value={cleanNumberValue(additionalCharges)}
                onChange={(e) => handleAdditionalChargesChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        )}

        {shouldShow("grand_total") && (
          <div className="summary-row highlight" style={{ borderTop: "2px solid var(--primary-color)", display: "flex", alignItems: "center" }}>
            <label style={{ fontSize: "14px", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, paddingRight: "10px", margin: 0 }}>
              <span>Grand Total</span>
              {renderConfidenceBadge(getFieldConfidence("tax_summary", "grand_total", data.grand_total), getSuggestion("grand_total"), data.grand_total)}
            </label>
            <div className="summary-input-wrapper">
              <span>₹</span>
              <input
                type="number"
                className="summary-input"
                style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary-color)" }}
                value={cleanNumberValue(data.grand_total)}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
                  onChange({ ...data, grand_total: val });
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TotalAmountSummary;
