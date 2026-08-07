from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/pdf/{document_id}")
async def get_pdf(document_id: str):
    path = os.path.join(UPLOAD_DIR, f"{document_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF tidak ditemukan")
    return FileResponse(path, media_type="application/pdf")