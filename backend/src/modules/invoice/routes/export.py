from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from fastapi.responses import (
    FileResponse
)

from sqlalchemy.orm import Session

from database import get_db

from services.excel_service import (
    ExcelService
)

from services.pdf_service import (
    PDFService
)

from services.queue_service import (
    QueueService
)

router = APIRouter()


@router.get("/export/excel")
def export_excel(
    db: Session = Depends(get_db)
):

    file_path = (
        ExcelService.generate_inventory_excel(
            db
        )
    )

    return FileResponse(
        path=file_path,
        filename="inventory_export.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get(
    "/export/summary/{document_id}"
)
def export_summary(
    document_id: str,
    db: Session = Depends(get_db)
):

    document = QueueService.get_document(
        db,
        document_id
    )

    if not document:

        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    file_path = (
        PDFService.generate_summary_pdf(
            document
        )
    )

    return FileResponse(
        path=file_path,
        filename=f"{document_id}.pdf",
        media_type="application/pdf"
    )