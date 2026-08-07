from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, ingest, chat, pdf
from routes import upload, ingest, chat, pdf, jdih
import os
os.environ.setdefault("HF_HUB_OFFLINE", "1")

app = FastAPI(title="Chatbot RAG Perda DIY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(pdf.router)
app.include_router(jdih.router)

@app.get("/health")
async def health():
    return {"status": "ok"}