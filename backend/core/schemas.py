from pydantic import BaseModel

class ChatRequest(BaseModel):
    document_id: str
    question: str

class ChatResponse(BaseModel):
    answer: str
    source_pages: list[int] = []
    source_pasal: list[str] = []

class IngestRequest(BaseModel):
    document_id: str
    nomor_perda: str = "unknown"
    tahun: str = "unknown"

class UploadResponse(BaseModel):
    document_id: str
    filename: str