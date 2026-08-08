import os
os.environ.setdefault("NLTK_DISABLE_IMPORT_SECURITY", "1")

from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Base paths ---
BASE_DIR = Path(__file__).resolve().parent
DOCUMENTS_DIR = BASE_DIR / os.getenv("DOCUMENTS_DIR", "documents")
MARKDOWN_DIR = BASE_DIR / os.getenv("MARKDOWN_DIR", "markdown_docs")
CHROMA_DIR = BASE_DIR / os.getenv("CHROMA_DIR", "chroma_db")

for path in (DOCUMENTS_DIR, MARKDOWN_DIR, CHROMA_DIR):
    path.mkdir(parents=True, exist_ok=True)

# --- OpenRouter (LLM, hanya untuk query) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL_PRIMARY = os.getenv("OPENROUTER_MODEL_PRIMARY", "google/gemma-2-9b-it:free")
OPENROUTER_MODEL_FALLBACK = os.getenv("OPENROUTER_MODEL_FALLBACK", "meta-llama/llama-3.1-8b-instruct:free")

# --- Embedding lokal ---
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")

# --- JDIH API ---
JDIH_API_BASE_URL = os.getenv("JDIH_API_BASE_URL", "https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/")

# --- ChromaDB ---
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "jdih_diy_docs")

if not OPENROUTER_API_KEY:
    print("[WARNING] OPENROUTER_API_KEY belum diisi di .env — query engine tidak akan berfungsi.")