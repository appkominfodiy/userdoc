from fastapi import APIRouter, HTTPException
from core.schemas import IngestRequest
from services.parser import DocumentParser
from services.chunker import chunk_perda
from services.vectorstore import vectorstore_service
from services.chunker import chunk_document
import os

router = APIRouter()
UPLOAD_DIR = "uploads"

_parser = None

def get_parser():
    global _parser
    if _parser is None:
        _parser = DocumentParser()
    return _parser


@router.post("/ingest")
async def ingest_document(payload: IngestRequest):
    pdf_path = os.path.join(UPLOAD_DIR, f"{payload.document_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF belum diupload atau document_id salah")

    # Cek dulu apakah dokumen ini SUDAH pernah di-ingest sebelumnya --
    # kalau ya, skip seluruh parsing/chunking/embedding, langsung pakai
    # yang sudah ada. document_id sekarang berbasis hash isi file, jadi
    # file identik akan selalu punya document_id yang sama.
    existing_count = vectorstore_service.get_chunk_count(payload.document_id)
    if existing_count > 0:
        return {
            "status": "success",
            "document_id": payload.document_id,
            "chunks_stored": existing_count,
            "cached": True,
        }

    try:
        content_list = get_parser().parse(pdf_path, output_dir=f"parsed_output/{payload.document_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal parsing PDF: {str(e)}")

    metadata_base = {
        "filename": f"{payload.document_id}.pdf",
        "nomor_perda": payload.nomor_perda,
        "tahun": payload.tahun,
    }
    chunks = chunk_document(content_list, metadata_base)

    if not chunks:
        raise HTTPException(status_code=422, detail="Parsing berhasil tapi tidak ada chunk terbentuk — kemungkinan dokumen bukan Perda atau strukturnya tidak dikenali")

    count = vectorstore_service.store_chunks(payload.document_id, chunks)

    return {
        "status": "success",
        "document_id": payload.document_id,
        "chunks_stored": count,
        "cached": False,
    }