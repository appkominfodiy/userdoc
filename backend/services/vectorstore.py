from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from typing import List, Dict, Any
from services.embedder import embedding_service
import re
import logging

logger = logging.getLogger(__name__)

QDRANT_URL = "http://localhost:6333"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2 (sudah diubah dari 1024)


class VectorStoreService:
    def __init__(self):
        self._client = QdrantClient(url=QDRANT_URL)

    def _collection_name(self, document_id: str) -> str:
        return f"doc_{document_id}"

    def store_chunks(self, document_id: str, chunks: List[Dict[str, Any]], batch_size: int = 20) -> int:
        name = self._collection_name(document_id)

        if not self._client.collection_exists(name):
            self._client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE,
                    distance=Distance.COSINE,
                    on_disk=True
                ),
            )
            logger.info(f"Koleksi {name} dibuat dengan on_disk=True")

        total_stored = 0
        total_chunks = len(chunks)
        logger.info(f"Memulai penyimpanan {total_chunks} chunk dengan batch size {batch_size}...")

        for i in range(0, total_chunks, batch_size):
            batch = chunks[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (total_chunks + batch_size - 1) // batch_size

            logger.info(f"Batch {batch_num}/{total_batches}: memproses {len(batch)} teks...")

            try:
                texts = [c["text"] for c in batch]
                vectors = embedding_service.embed_documents(texts)
            except Exception as e:
                logger.error(f"Gagal embedding batch {batch_num}: {str(e)}")
                raise

            points = []
            for j, (chunk, vector) in enumerate(zip(batch, vectors)):
                payload = {k: (v if v is not None else "") for k, v in chunk.items()}
                points.append(PointStruct(
                    id=i + j,
                    vector=vector,
                    payload=payload
                ))

            try:
                self._client.upsert(collection_name=name, points=points, wait=True)
                total_stored += len(points)
                logger.info(f"Batch {batch_num}/{total_batches} selesai, {len(points)} chunk tersimpan.")
            except Exception as e:
                logger.error(f"Gagal upsert batch {batch_num}: {str(e)}")
                raise

        logger.info(f"Total {total_stored} chunk berhasil disimpan.")
        return total_stored

    def get_chunk_count(self, document_id: str) -> int:
        name = self._collection_name(document_id)
        if not self._client.collection_exists(name):
            return 0
        return self._client.count(collection_name=name, exact=True).count

    def similarity_search(self, document_id: str, query_text: str, k: int = 5) -> List[Dict[str, Any]]:
        name = self._collection_name(document_id)
        if not self._client.collection_exists(name):
            return []

        query_vector = embedding_service.embed_query([query_text])[0]
        result = self._client.query_points(
            collection_name=name, query=query_vector, limit=k, with_payload=True,
        )

        found = []
        for point in result.points:
            payload = point.payload or {}
            found.append({
                "text": payload.get("text", ""),
                "metadata": payload,
                "score": point.score if point.score is not None else 0.0,
            })
        return found

    def find_by_pasal(self, document_id: str, pasal: str):
        name = self._collection_name(document_id)
        if not self._client.collection_exists(name):
            return None

        def _normalize(value: str) -> str:
            return re.sub(r"[^a-z0-9]", "", str(value).lower())

        candidates = []

        # 1. Eksak
        scroll_result = self._client.scroll(
            collection_name=name,
            scroll_filter=Filter(must=[
                FieldCondition(key="pasal", match=MatchValue(value=pasal)),
            ]),
            limit=100,
        )[0]
        candidates = [p.payload for p in scroll_result if p.payload]

        # 2. Kapital semua
        if not candidates:
            scroll_result = self._client.scroll(
                collection_name=name,
                scroll_filter=Filter(must=[
                    FieldCondition(key="pasal", match=MatchValue(value=pasal.upper())),
                ]),
                limit=100,
            )[0]
            candidates = [p.payload for p in scroll_result if p.payload]

        # 3. Scan manual
        if not candidates:
            target = _normalize(pasal)
            all_points = self._client.scroll(collection_name=name, limit=1000)[0]
            candidates = [
                p.payload for p in all_points
                if p.payload and _normalize(p.payload.get("pasal", "")) == target
            ]

        if not candidates:
            return None

        # Prioritas batang_tubuh
        batang_candidates = [c for c in candidates if c.get("section") == "batang_tubuh"]
        if batang_candidates:
            candidates = batang_candidates

        best = min(candidates, key=lambda p: int(p.get("halaman") or 0))
        return best

    def find_by_label(self, document_id: str, label_keyword: str):
        name = self._collection_name(document_id)
        if not self._client.collection_exists(name):
            return None

        all_points = self._client.scroll(collection_name=name, limit=1000)[0]
        candidates = [
            p.payload for p in all_points
            if p.payload and label_keyword.lower() in str(p.payload.get("label", "")).lower()
        ]

        if not candidates:
            return None

        best = min(candidates, key=lambda p: int(p.get("halaman") or 0))
        return best

    # ---- TAMBAHAN: Fungsi untuk mencari berdasarkan section ----
    def find_by_section(self, document_id: str, section: str):
        """
        Cari chunk berdasarkan section (misal 'pembukaan', 'batang_tubuh').
        """
        name = self._collection_name(document_id)
        if not self._client.collection_exists(name):
            return None

        scroll_result = self._client.scroll(
            collection_name=name,
            scroll_filter=Filter(must=[
                FieldCondition(key="section", match=MatchValue(value=section)),
            ]),
            limit=10,
        )[0]
        candidates = [p.payload for p in scroll_result if p.payload]
        if not candidates:
            return None
        # Ambil yang halaman terkecil (biasanya pembukaan di awal)
        best = min(candidates, key=lambda p: int(p.get("halaman") or 0))
        return best


vectorstore_service = VectorStoreService()