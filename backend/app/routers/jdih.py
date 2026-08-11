from fastapi import APIRouter
from pydantic import BaseModel
from app.services.jdih_sync import sync_jdih_documents, sync_single_document

router = APIRouter()

class AnalyzeRequest(BaseModel):
    slug: str

@router.post("/sync-jdih")
def sync_jdih_endpoint(page: int = 1, size: int = 10):
    """
    Endpoint untuk menarik data produk hukum dari API JDIH dan memproses PDF-nya.
    """
    try:
        result = sync_jdih_documents(page, size)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/analyze-pdf")
def analyze_pdf_endpoint(request: AnalyzeRequest):
    """
    Endpoint untuk menganalisis dan memasukkan satu dokumen PDF secara spesifik.
    """
    try:
        result = sync_single_document(request.slug)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

