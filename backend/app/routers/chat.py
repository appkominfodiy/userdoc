from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.vector_store import search_similar_chunks
from app.services.llm_service import generate_response
from app.services.pdf_on_the_fly import process_pdf_on_the_fly

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    top_k: int = 3
    pdf_url: Optional[str] = None

@router.post("/chat")
def chat_endpoint(request: ChatRequest):
    """
    Endpoint utama chatbot. Menggabungkan pencarian vektor (RAG) dengan LLM.
    """
    try:
        # 1. Cari konteks yang relevan di database vektor atau langsung dari PDF
        if request.pdf_url:
            context_chunks = process_pdf_on_the_fly(request.pdf_url, request.query, top_k=request.top_k)
        else:
            context_chunks = search_similar_chunks(request.query, top_k=request.top_k)
        
        # 2. Hasilkan respons menggunakan LLM
        answer = generate_response(request.query, context_chunks)
        
        # 3. Kumpulkan metadata sumber
        sources = []
        for chunk in context_chunks:
            source_info = f"{chunk['filename']} (Hal. {chunk['page_number']})"
            if source_info not in sources:
                sources.append(source_info)
                
        return {
            "status": "success",
            "query": request.query,
            "answer": answer,
            "sources": sources
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
