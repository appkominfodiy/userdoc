"""
search.py
=========
Router KHUSUS UNTUK TESTING fitur similarity search / retrieval,
secara terpisah dari endpoint /chat utama (yang akan kita buat di
Tahap 9). Ini membantu kita memverifikasi retrieval bekerja dengan
benar SEBELUM kita gabungkan dengan LLM.
"""

from fastapi import APIRouter
from app.services.vector_store import search_similar_chunks

router = APIRouter()


@router.get("/search")
def search(query: str, top_k: int = 3):
    """
    Endpoint untuk menguji pencarian kemiripan (similarity search) secara
    langsung, tanpa melibatkan LLM. Berguna untuk memastikan sistem
    retrieval bekerja dengan benar sebelum dipakai di endpoint /chat.

    Parameters:
        query (str): pertanyaan yang ingin dicari kemiripannya dengan
                      chunk-chunk yang sudah tersimpan di ChromaDB.
        top_k (int): jumlah hasil teratas yang ingin ditampilkan. Default 3.

    Returns:
        dict: berisi query asli dan list hasil chunk paling relevan.
    """
    results = search_similar_chunks(query, top_k=top_k)

    return {
        "query": query,
        "results_count": len(results),
        "results": results
    }