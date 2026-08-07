from sentence_transformers import SentenceTransformer
from typing import List

class EmbeddingService:
    _model = None 

    def __init__(self):
        if EmbeddingService._model is None:
            EmbeddingService._model = SentenceTransformer("BAAI/bge-m3")  # ganti model ini sesuai kebutuhan, bisa diganti dengan model lain yang tersedia di Hugging Face

    def embed(self, texts: List[str]) -> List[List[float]]:
        embeddings = EmbeddingService._model.encode(
            texts,
            normalize_embeddings=True,  
        )
        return embeddings.tolist()

embedding_service = EmbeddingService()