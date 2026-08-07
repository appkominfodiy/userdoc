from fastapi import APIRouter
from core.schemas import ChatRequest, ChatResponse
from services.rag_chat import answer_question

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    result = answer_question(payload.document_id, payload.question)
    return ChatResponse(
        answer=result["answer"],
        source_pages=[s["halaman"] for s in result["sources"]],
        source_pasal=[s["pasal"] for s in result["sources"]],
    )