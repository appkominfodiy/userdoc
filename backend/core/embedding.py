"""
Modul embedding lokal menggunakan SentenceTransformer via HuggingFace,
dibungkus dalam format yang kompatibel langsung dengan LlamaIndex.
"""

import sys
import threading
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402 (set NLTK_DISABLE_IMPORT_SECURITY duluan)

from llama_index.embeddings.huggingface import HuggingFaceEmbedding

_embed_model_instance = None
_embed_lock = threading.Lock()


def get_embedding_model() -> HuggingFaceEmbedding:
    """
    Singleton thread-safe (double-checked locking) — mencegah model
    ke-load 2x kalau 2 request datang bersamaan.
    """
    global _embed_model_instance
    if _embed_model_instance is None:
        with _embed_lock:
            if _embed_model_instance is None:
                print(f"[INFO] Memuat embedding model lokal: {config.EMBEDDING_MODEL_NAME}")
                _embed_model_instance = HuggingFaceEmbedding(
                    model_name=config.EMBEDDING_MODEL_NAME,
                    embed_batch_size=16,
                )
                print("[INFO] Embedding model siap digunakan.")
    return _embed_model_instance


if __name__ == "__main__":
    model = get_embedding_model()
    sample_text = "Peraturan Daerah Istimewa Yogyakarta tentang tata ruang."
    vector = model.get_text_embedding(sample_text)
    print(f"[TEST] Panjang vektor embedding: {len(vector)}")
    print(f"[TEST] 5 nilai pertama: {vector[:5]}")