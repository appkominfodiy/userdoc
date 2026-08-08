"""
FastAPI backend untuk Chatbot RAG JDIH DIY.

CATATAN FILTER KATEGORI: API JDIH tidak punya filter kategori yang presisi
lewat parameter 'q' (itu full-text search bebas, bukan exact match) — jadi
filter kategori dilakukan DI SINI (backend kita), bukan dikirim ke API luar.
Strategi: ambil dokumen dalam batch besar dari API (tanpa filter kategori),
lalu filter exact-match ke field 'kategori_hukum_name' sampai cukup untuk
1 halaman (PAGE_SIZE), dengan batas maksimum jumlah batch yang di-scan biar
tidak nge-loop selamanya kalau kategori itu sangat jarang/tidak ada.
"""

import sys
from pathlib import Path

import httpx

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402 (set NLTK_DISABLE_IMPORT_SECURITY duluan)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pypdf import PdfReader

from services.jdih_api import get_jdih_client
from core.parser import get_parser
from core.rag_engine import get_rag_engine

app = FastAPI(title="Chatbot RAG JDIH DIY API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PAGE_SIZE = 9
EXTERNAL_FETCH_SIZE = 50   # ukuran batch saat scan API JDIH untuk filter kategori
MAX_SCAN_BATCHES = 40      # batas aman (~2000 dokumen di-scan) biar tidak infinite loop


class ChatRequest(BaseModel):
    doc_id: str
    question: str


class FollowupRequest(BaseModel):
    question: str
    answer: str


def resolve_doc_id(doc: dict) -> str:
    numeric_id = doc.get("id")
    slug = doc.get("slug")
    title = doc.get("judul_peraturan") or doc.get("nomor") or "dokumen"
    return str(numeric_id) if numeric_id else (slug[:60] if slug else title[:60])


def fetch_native_page(page: int, tahun: str, q: str):
    """Tanpa filter kategori — pakai pagination NATIVE dari API JDIH langsung (akurat & cepat)."""
    client = get_jdih_client()
    params = {"page": page, "size": PAGE_SIZE, "order": "-tanggal_pengundangan"}
    if tahun:
        params["tahun"] = tahun
    if q:
        params["q"] = q

    resp = client.client.get(client.base_url, params=params)
    resp.raise_for_status()
    data = resp.json()

    documents = data.get("data", [])
    for doc in documents:
        doc["doc_id"] = resolve_doc_id(doc)

    paging = data.get("paging", {})
    total_page = paging.get("total_page", 1)

    return {
        "documents": documents,
        "page": page,
        "has_next": page < total_page,
        "total_page": total_page,
        "total_item": paging.get("total_item"),
        "filtered": False,
    }


def fetch_filtered_page(page: int, kategori: str, tahun: str, q: str):
    """
    Dengan filter kategori — scan API JDIH batch demi batch, filter exact-match
    ke 'kategori_hukum_name', akumulasi sampai cukup untuk halaman yang diminta.
    total_page TIDAK diketahui pasti (mahal untuk dihitung akurat), jadi
    frontend sebaiknya pakai Prev/Next saja (bukan nomor halaman) saat kategori aktif.
    """
    client = get_jdih_client()
    kategori_lower = kategori.strip().lower()
    needed = page * PAGE_SIZE

    matched: list[dict] = []
    external_page = 1

    while len(matched) < needed + 1 and external_page <= MAX_SCAN_BATCHES:
        params = {"page": external_page, "size": EXTERNAL_FETCH_SIZE, "order": "-tanggal_pengundangan"}
        if tahun:
            params["tahun"] = tahun
        if q:
            params["q"] = q

        resp = client.client.get(client.base_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("data", [])
        if not batch:
            break  # API sudah habis, tidak ada data lagi

        for doc in batch:
            if (doc.get("kategori_hukum_name") or "").strip().lower() == kategori_lower:
                doc["doc_id"] = resolve_doc_id(doc)
                matched.append(doc)

        external_page += 1

    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE
    page_slice = matched[start:end]
    has_next = len(matched) > end

    return {
        "documents": page_slice,
        "page": page,
        "has_next": has_next,
        "total_page": None,   # tidak diketahui pasti saat filter aktif
        "total_item": None,
        "filtered": True,
    }


@app.get("/documents")
def list_documents(page: int = 1, q: str = "", tahun: str = "", kategori: str = ""):
    try:
        if kategori and kategori.strip():
            return fetch_filtered_page(page, kategori.strip(), tahun.strip(), q.strip())
        return fetch_native_page(page, tahun.strip(), q.strip())
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Server JDIH timeout.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal terhubung ke API JDIH: {e}")


@app.get("/documents/{doc_id}/detail")
def get_document_detail(doc_id: str, slug: str):
    client = get_jdih_client()
    detail = client.get_document_detail(slug)
    if not detail:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    detail["doc_id"] = doc_id
    return detail


@app.post("/documents/{doc_id}/prepare")
def prepare_document(doc_id: str, slug: str):
    client = get_jdih_client()
    parser = get_parser()
    engine = get_rag_engine()

    pdf_path = config.DOCUMENTS_DIR / f"{doc_id}.pdf"
    md_path = config.MARKDOWN_DIR / f"{doc_id}.md"

    if not pdf_path.exists():
        detail = client.get_document_detail(slug)
        pdf_url = detail.get("file_peraturan") if detail else None
        if not pdf_url:
            raise HTTPException(status_code=404, detail="URL PDF tidak ditemukan untuk dokumen ini.")
        client.download_pdf(pdf_url, f"{doc_id}.pdf")

    if not md_path.exists():
        parser.convert_pdf_to_markdown(pdf_path)

    markdown_text = md_path.read_text(encoding="utf-8")
    engine.ingest_document(markdown_text, doc_id=doc_id)

    total_pages = len(PdfReader(str(pdf_path)).pages)
    return {"doc_id": doc_id, "ready": True, "total_pages": total_pages}


@app.get("/documents/{doc_id}/pdf")
def get_document_pdf(doc_id: str):
    pdf_path = config.DOCUMENTS_DIR / f"{doc_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF belum diproses. Panggil /prepare dulu.")
    return FileResponse(str(pdf_path), media_type="application/pdf")


@app.get("/documents/{doc_id}/markdown")
def get_document_markdown(doc_id: str):
    """Isi markdown hasil parsing Marker — dipakai frontend untuk preview teks / ekstraksi tambahan."""
    md_path = config.MARKDOWN_DIR / f"{doc_id}.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail="Markdown belum tersedia. Panggil /prepare dulu.")
    markdown_text = md_path.read_text(encoding="utf-8")
    return {"doc_id": doc_id, "markdown_text": markdown_text}


@app.post("/chat")
def chat(payload: ChatRequest):
    engine = get_rag_engine()
    try:
        result = engine.chat_document(payload.question, doc_id=payload.doc_id)
        return {"answer": result["answer"], "sources": result["sources"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/{doc_id}/reset")
def reset_chat(doc_id: str):
    engine = get_rag_engine()
    engine.reset_chat_memory(doc_id)
    return {"reset": True}


@app.get("/documents/{doc_id}/suggest-questions")
def suggest_questions(doc_id: str):
    """Pertanyaan STARTER, dibuat LLM dari cuplikan isi dokumen ini (bukan template statis)."""
    engine = get_rag_engine()
    try:
        questions = engine.generate_suggested_questions(doc_id)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents/{doc_id}/suggest-followup")
def suggest_followup(doc_id: str, payload: FollowupRequest):
    """Pertanyaan FOLLOW-UP, dibuat LLM berdasarkan jawaban chat terakhir."""
    engine = get_rag_engine()
    try:
        questions = engine.generate_suggested_questions(
            doc_id, based_on_qa=(payload.question, payload.answer)
        )
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}