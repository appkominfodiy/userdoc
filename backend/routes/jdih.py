from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.jdih_client import jdih_client
from services.vectorstore import vectorstore_service
import hashlib
import os

router = APIRouter()
UPLOAD_DIR = "uploads"


@router.get("/jdih/list")
async def list_jdih_documents(
    page: int = 1,
    size: int = 10,
    order: str = "-tanggal_pengundangan",
    tahun: Optional[int] = None,
    kategori_hukum_id: Optional[int] = None,
    status_produk_hukum: Optional[int] = None,
    search: Optional[str] = None,
):
    try:
        data = jdih_client.list_documents(
            page=page,
            size=size,
            order=order,
            tahun=tahun,
            kategori_hukum_id=kategori_hukum_id,
            status_produk_hukum=status_produk_hukum,
            search=search,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengambil data dari JDIH: {str(e)}")
    return data


@router.post("/jdih/select/{doc_id}")
async def select_jdih_document(doc_id: int, file_url: str):
    try:
        content = jdih_client.download_pdf(file_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunduh PDF: {str(e)}")

    document_id = hashlib.sha256(content).hexdigest()
    save_path = os.path.join(UPLOAD_DIR, f"{document_id}.pdf")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    if not os.path.exists(save_path):
        with open(save_path, "wb") as f:
            f.write(content)

    existing_count = vectorstore_service.get_chunk_count(document_id)

    return {
        "document_id": document_id,
        "already_processed": existing_count > 0,
    }