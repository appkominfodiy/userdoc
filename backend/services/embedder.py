from sentence_transformers import SentenceTransformer
from typing import List
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        # Model ringan, dimensi 384, cepat di CPU
        self._model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        logger.info("Embedding model loaded: all-MiniLM-L6-v2 (384 dimensi)")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # Encode menghasilkan numpy array, lalu convert ke list of lists
        embeddings = self._model.encode(texts)
        return embeddings.tolist()

    def embed_query(self, texts: List[str]) -> List[List[float]]:
        embeddings = self._model.encode(texts)
        return embeddings.tolist()


embedding_service = EmbeddingService()