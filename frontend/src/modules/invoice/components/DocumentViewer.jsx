function DocumentViewer({
  document,
}) {

  if (!document)
    return null;

  const token = localStorage.getItem("token") || "";
  const imageUrl = `http://${window.location.hostname}:8000/api/documents/${document.document_id}/file?token=${token}`;

  return (
    <div className="document-viewer">

      <h3>
        Invoice Preview
      </h3>

      <img
        src={imageUrl}
        alt="invoice"
        style={{
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: "8px"
        }}
      />

    </div>
  );
}

export default DocumentViewer;
