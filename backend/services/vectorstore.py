import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
from services.embedder import embedding_service

CHROMA_PATH = "chroma"


class VectorStoreService:
    def __init__(self):
        self._client = chromadb.PersistentClient(path=CHROMA_PATH)

    def _collection_name(self, document_id: str) -> str:
        return f"doc_{document_id}"

    def store_chunks(self, document_id: str, chunks: List[Dict[str, Any]]) -> int:
        collection = self._client.get_or_create_collection(
            name=self._collection_name(document_id),
            metadata={"hnsw:space": "cosine"},
        )

        texts = [c["text"] for c in chunks]
        vectors = embedding_service.embed(texts)

        metadatas = []
        for c in chunks:
            meta = {k: v for k, v in c.items() if k != "text"}
            meta = {k: (v if v is not None else "") for k, v in meta.items()}
            metadatas.append(meta)

        ids = [f"{document_id}_{i}" for i in range(len(chunks))]

        collection.add(
            ids=ids,
            embeddings=vectors,
            documents=texts,
            metadatas=metadatas,
        )
        return len(chunks)

    def get_collection(self, document_id: str):
        return self._client.get_collection(self._collection_name(document_id))

    def get_chunk_count(self, document_id: str) -> int:
        """
        Cek apakah collection untuk document_id ini sudah ada dan berisi
        chunk. Return 0 kalau belum pernah di-ingest (collection belum ada).
        """
        try:
            collection = self._client.get_collection(self._collection_name(document_id))
            return collection.count()
        except Exception:
            return 0


vectorstore_service = VectorStoreService()