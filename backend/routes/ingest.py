from fastapi import APIRouter, HTTPException
from core.schemas import IngestRequest
from services.parser import DocumentParser
from services.vectorstore import vectorstore_service
from services.chunker import chunk_document
import os
import logging
import traceback
import asyncio
import pymupdf  # PyMuPDF - pip install pymupdf

logger = logging.getLogger(__name__)

router = APIRouter()
UPLOAD_DIR = "uploads"

_parser = None

def get_parser():
    global _parser
    if _parser is None:
        _parser = DocumentParser()
    return _parser


# ============================================================
# FUNGSI FALLBACK: Ekstrak teks pakai PyMuPDF (ringan, hemat memory)
# ============================================================
def _extract_with_pymupdf(pdf_path: str):
    """
    Ekstrak teks dari PDF menggunakan PyMuPDF.
    Output dibuat semirip mungkin dengan format MinerU agar kompatibel.
    """
    logger.info(f"Fallback: mencoba ekstraksi dengan PyMuPDF untuk {pdf_path}")
    doc = pymupdf.open(pdf_path)
    content_list = []
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text()
        if text and text.strip():
            content_list.append({
                "type": "text",
                "text": text,
                "page_idx": page_num,
                "bbox": [0, 0, 0, 0],
            })
    doc.close()
    logger.info(f"Fallback: berhasil ekstrak {len(content_list)} halaman")
    return content_list


@router.post("/ingest")
async def ingest_document(payload: IngestRequest):
    logger.info("=== INGEST START ===")
    logger.info(f"document_id: {payload.document_id}")
    logger.info(f"nomor_perda: {payload.nomor_perda}")
    logger.info(f"tahun: {payload.tahun}")

    pdf_path = os.path.join(UPLOAD_DIR, f"{payload.document_id}.pdf")
    if not os.path.exists(pdf_path):
        logger.error(f"File tidak ditemukan: {pdf_path}")
        raise HTTPException(status_code=404, detail="PDF belum diupload atau document_id salah")

    # Cek cache
    existing_count = vectorstore_service.get_chunk_count(payload.document_id)
    if existing_count > 0:
        logger.info(f"Dokumen sudah ada di vectorstore, skip proses. chunks={existing_count}")
        return {
            "status": "success",
            "document_id": payload.document_id,
            "chunks_stored": existing_count,
            "cached": True,
        }

    # ============================================================
    # PARSE: coba MinerU, fallback PyMuPDF
    # ============================================================
    content_list = None

    try:
        logger.info("Mencoba parsing dengan MinerU...")
        content_list = get_parser().parse(pdf_path, output_dir=f"parsed_output/{payload.document_id}")
        logger.info("MinerU berhasil.")
    except Exception as e:
        logger.warning(f"MinerU gagal: {str(e)}")
        logger.warning(traceback.format_exc())
        try:
            logger.info("Mencoba fallback dengan PyMuPDF...")
            content_list = _extract_with_pymupdf(pdf_path)
            if not content_list:
                raise Exception("Fallback menghasilkan teks kosong.")
            logger.info("Fallback PyMuPDF berhasil.")
        except Exception as fallback_e:
            logger.error(f"Fallback juga gagal: {str(fallback_e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Gagal parsing PDF (MinerU & fallback): {str(fallback_e)}")

    if not content_list or len(content_list) == 0:
        logger.error("content_list kosong setelah parsing.")
        raise HTTPException(status_code=422, detail="Tidak ada teks yang berhasil diekstrak dari PDF.")

    logger.info(f"Jumlah item dalam content_list: {len(content_list)}")

    # ============================================================
    # CHUNKING
    # ============================================================
    metadata_base = {
        "filename": f"{payload.document_id}.pdf",
        "nomor_perda": payload.nomor_perda,
        "tahun": payload.tahun,
    }
    try:
        logger.info("Memulai chunking...")
        chunks = chunk_document(content_list, metadata_base)
    except Exception as e:
        logger.error(f"Error saat chunking: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Gagal chunking: {str(e)}")

    if not chunks:
        logger.warning("chunk_document mengembalikan list kosong.")
        raise HTTPException(status_code=422, detail="Parsing berhasil tapi tidak ada chunk terbentuk — kemungkinan dokumen bukan Perda atau strukturnya tidak dikenali")

    logger.info(f"Chunking selesai, menghasilkan {len(chunks)} chunk.")

    # ============================================================
    # SIMPAN KE QDRANT dengan timeout
    # ============================================================
    try:
        logger.info("Memulai penyimpanan ke vectorstore...")
        # Jalankan dengan timeout 600 detik (5 menit)
        count = await asyncio.wait_for(
            asyncio.to_thread(vectorstore_service.store_chunks, payload.document_id, chunks),
            timeout=600
        )
        logger.info(f"Penyimpanan ke vectorstore selesai, tersimpan {count} chunk.")
    except asyncio.TimeoutError:
        logger.error("Timeout: Penyimpanan ke vectorstore memakan waktu terlalu lama.")
        raise HTTPException(status_code=500, detail="Proses penyimpanan timeout, coba lagi nanti.")
    except Exception as e:
        logger.error(f"Error saat menyimpan ke vectorstore: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan ke database: {str(e)}")

    logger.info(f"=== INGEST SELESAI: {count} chunks tersimpan ===")
    return {
        "status": "success",
        "document_id": payload.document_id,
        "chunks_stored": count,
        "cached": False,
    }