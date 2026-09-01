import { useState, useEffect } from "react";

function DocumentPreview({ document, verificationTime = 0, timerActive = false, documents = [], onSelect }) {
  const [zoom, setZoom] = useState(1.0);
  const [imgError, setImgError] = useState(false);

  // Reset zoom and imgError on document change
  useEffect(() => {
    setZoom(1.0);
    setImgError(false);
  }, [document]);

  if (!document) {
    return (
      <div className="empty-state">
        <p>No document selected</p>
      </div>
    );
  }

  const filename = document.filename || "";
  const filePath = document.file_path || "";
  const isUploading = document.document_id === "temp-uploading";
  const isPdf = !isUploading && (filename.toLowerCase().endsWith(".pdf") || filePath.toLowerCase().endsWith(".pdf"));

  const token = localStorage.getItem("token") || "";
  const fileUrl = isUploading ? "" : `http://${window.location.hostname}:8000/api/documents/${document.document_id}/file?token=${token}`;

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 2.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const zoomFit = () => setZoom(1.0);

  const handleDownload = () => {
    if (!fileUrl) return;
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename || "invoice";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="document-preview-block" style={{ width: "40%" }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
      <div className="preview-header">
        <span className="preview-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {(() => {
            const extraction = document.final_extraction || document.ocr_result?.extraction;
            const vendorName = extraction?.vendor_details?.name;
            const invoiceNumber = extraction?.invoice_details?.invoice_number;
            if (vendorName && invoiceNumber) {
              return `${vendorName} — #${invoiceNumber}`;
            } else if (vendorName) {
              return vendorName;
            } else if (invoiceNumber) {
              return `Invoice #${invoiceNumber}`;
            }
            return `Invoice Preview: ${filename}`;
          })()}
          {timerActive ? (
            <span className="timer-badge active" style={{ fontSize: "12px", color: "#d97706", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", padding: "2px 8px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span className="pulse-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706", display: "inline-block", animation: "pulse 1.5s infinite" }}></span>
              Stopwatch: {verificationTime}s
            </span>
          ) : verificationTime > 0 ? (
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-card-highlight)", border: "1px solid var(--border-color)", padding: "2px 8px", borderRadius: "12px" }}>
              ⏱️ Stopwatch: {verificationTime}s (Paused)
            </span>
          ) : null}
        </span>
      </div>

      <div className="document-viewer-container">
        {isUploading ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
            color: "var(--text-secondary)",
            background: "var(--bg-card-highlight)",
            borderRadius: "8px",
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <div style={{
              border: "3px solid rgba(255,255,255,0.1)",
              borderTop: "3px solid var(--primary-glow)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              animation: "spin 1s linear infinite"
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                Uploading Document...
              </p>
              <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
                Processing invoice OCR data. Please wait...
              </p>
            </div>
          </div>
        ) : isPdf ? (
          <iframe
            src={`${fileUrl}#view=FitH&zoom=${Math.round(zoom * 100)}`}
            title="PDF Document Viewer"
            className="pdf-preview"
          />
        ) : imgError ? (
          /* Friendly placeholder when the image cannot be loaded */
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
            color: "var(--text-secondary)",
            background: "var(--bg-card-highlight)",
            borderRadius: "8px",
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <svg width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.35 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                Image preview not available
              </p>
              <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
                The original file is no longer stored on this server.
                <br />
                {document.status === "Failed"
                  ? "Re-upload the invoice to process it again."
                  : "OCR data below is still available."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="image-preview-wrapper"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={fileUrl}
              alt="Invoice Document Preview"
              className="image-preview"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>

      {(() => {
        const pendingDocs = documents.filter(d => d.status === "PENDING_VALIDATION");
        const currentIndex = pendingDocs.findIndex(d => d.document_id === document.document_id);
        const totalPending = pendingDocs.length;

        if (currentIndex === -1 || totalPending === 0) return null;

        return (
          <div className="preview-pagination-footer" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderTop: "1px solid var(--border-color)",
            background: "var(--bg-panel)",
            boxSizing: "border-box"
          }}>
            <button
              className="btn btn-secondary"
              disabled={currentIndex === 0}
              onClick={() => onSelect(pendingDocs[currentIndex - 1])}
              style={{
                fontSize: "11px",
                fontWeight: "700",
                padding: "6px 12px",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer"
              }}
            >
              ◀ PREVIOUS
            </button>
            <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>
              {currentIndex + 1} / {totalPending}
            </span>
            <button
              className="btn btn-secondary"
              disabled={currentIndex === totalPending - 1}
              onClick={() => onSelect(pendingDocs[currentIndex + 1])}
              style={{
                fontSize: "11px",
                fontWeight: "700",
                padding: "6px 12px",
                cursor: currentIndex === totalPending - 1 ? "not-allowed" : "pointer"
              }}
            >
              NEXT ▶
            </button>
          </div>
        );
      })()}
    </div>
  );
}

export default DocumentPreview;
