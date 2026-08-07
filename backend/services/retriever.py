import re
from typing import List, Dict, Any
from services.vectorstore import vectorstore_service
from services.embedder import embedding_service

PASAL_QUERY_PATTERN = re.compile(r"pasal\s+(\d+)", re.IGNORECASE)


class RetrieverService:
    def __init__(self, k: int = 5):
        self.k = k

    def _direct_pasal_lookup(self, document_id: str, question: str):
        """Kalau pertanyaan eksplisit menyebut 'Pasal N', ambil langsung
        chunk batang_tubuh pasal itu lewat metadata filter -- akurat,
        tidak bergantung similarity semantik yang bisa salah pilih."""
        match = PASAL_QUERY_PATTERN.search(question)
        if not match:
            return None

        pasal_target = f"Pasal {match.group(1)}"
        try:
            collection = vectorstore_service.get_collection(document_id)
            result = collection.get(
                where={"$and": [{"pasal": pasal_target}, {"section": "batang_tubuh"}]}
            )
        except Exception:
            return None

        if not result["documents"]:
            return None

        return {
            "text": result["documents"][0],
            "pasal": result["metadatas"][0].get("pasal"),
            "bab": result["metadatas"][0].get("bab"),
            "halaman": result["metadatas"][0].get("halaman"),
            "section": result["metadatas"][0].get("section"),
            "similarity_score": 1.0,
        }

    def retrieve(self, document_id: str, question: str) -> List[Dict[str, Any]]:
        direct = self._direct_pasal_lookup(document_id, question)

        collection = vectorstore_service.get_collection(document_id)
        query_vector = embedding_service.embed([question])[0]
        results = collection.query(query_embeddings=[query_vector], n_results=self.k)

        retrieved = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for text, meta, distance in zip(documents, metadatas, distances):
            display_label = meta.get("pasal") or meta.get("label") or meta.get("section") or "Bagian dokumen"
            retrieved.append({
                "text": text,
                "pasal": display_label,
                "bab": meta.get("bab"),
                "halaman": meta.get("halaman"),
                "section": meta.get("section"),
                "similarity_score": 1 - distance,
            })

        if direct:
            retrieved = [r for r in retrieved if not (r["pasal"] == direct["pasal"] and r["section"] == direct["section"])]
            retrieved.insert(0, direct)

        return retrieved


retriever_service = RetrieverService(k=5)