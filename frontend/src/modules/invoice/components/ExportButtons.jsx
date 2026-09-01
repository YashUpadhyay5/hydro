function ExportButtons() {

  const downloadExcel = () => {

    window.open(
      `http://${window.location.hostname}:8000/api/export/excel`
    );

  };

  return (
    <div className="export-buttons">

      <button
        onClick={downloadExcel}
      >
        Download Excel
      </button>

    </div>
  );
}

export default ExportButtons;
