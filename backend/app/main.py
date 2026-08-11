"""
main.py
========
Ini adalah file utama (entry point) aplikasi backend RAG PDF Chatbot.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import upload, ingest, search, jdih, chat
import os

app = FastAPI(
    title="RAG PDF Chatbot API",
    description="Backend API untuk chatbot RAG berbasis dokumen PDF",
    version="0.1.0",
)

# Create uploads dir if it doesn't exist
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(ingest.router)
app.include_router(search.router)
app.include_router(jdih.router)
app.include_router(chat.router)


@app.get("/")
def read_root():
    """Endpoint root/utama untuk memastikan API bisa diakses."""
    return {"message": "Selamat datang di RAG PDF Chatbot API"}


@app.get("/health")
def health_check():
    """Endpoint sederhana untuk mengecek apakah server backend hidup."""
    return {"status": "ok", "message": "Backend RAG Chatbot berjalan dengan baik!"}

# Reload trigger