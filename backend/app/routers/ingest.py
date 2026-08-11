"""
ingest.py
=========
Router yang menangani proses "ingest" - memproses PDF yang sudah
diupload menjadi teks bersih, memecahnya jadi chunk, mengubahnya
jadi embedding, dan menyimpannya ke ChromaDB.
"""

import os
from fastapi import APIRouter, HTTPException
from app.services.pdf_processor import extract_text_from_pdf
from app.services.chunker import chunk_pages
from app.services.vector_store import embed_and_store_chunks   # <-- BARU

router = APIRouter()

UPLOAD_DIR = "uploads"


@router.post("/ingest")
def ingest_pdf(filename: str):
    """
    Memproses file PDF yang sudah ada di folder uploads/ secara lengkap:
    1. Ekstrak teks per halaman
    2. Bersihkan teks
    3. Pecah jadi chunk-chunk kecil
    4. Ubah tiap chunk jadi vector embedding
    5. Simpan ke ChromaDB

    Parameters:
        filename (str): nama file PDF yang ingin diproses.

    Returns:
        dict: ringkasan hasil proses ingest lengkap.

    Raises:
        HTTPException 404: jika file tidak ditemukan di folder uploads/.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' tidak ditemukan. Upload dulu lewat /upload."
        )

    # Tahap 4: ekstrak & bersihkan teks
    pages = extract_text_from_pdf(file_path)

    # Tahap 5: pecah jadi chunk
    chunks = chunk_pages(pages, chunk_size=500, chunk_overlap=50)

    # Tahap 6: embedding + simpan ke ChromaDB
    stored_count = embed_and_store_chunks(chunks, filename)

    return {
        "filename": filename,
        "total_pages": len(pages),
        "total_chunks": len(chunks),
        "chunks_stored_in_db": stored_count,
        "message": "PDF berhasil diproses dan disimpan ke vector database"
    }