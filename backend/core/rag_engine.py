"""
RAG Engine berbasis LlamaIndex dengan fitur sumber halaman (sources).
- Chunking dengan MarkdownNodeParser
- Vector store: ChromaDB
- Embedding: lokal
- LLM: OpenRouter — fallback multi-model
- chat_document()/query_document(): return dict {"answer": ..., "sources": [...]}
- Thread-safe singleton (cegah race condition kalau ada request bersamaan)

CATATAN: field metadata custom "source_doc_id" — BUKAN "doc_id" (bentrok
dengan field internal ChromaVectorStore/LlamaIndex).
"""

import sys
import re
import json
import threading
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402 (set NLTK_DISABLE_IMPORT_SECURITY duluan)

import chromadb
from llama_index.core import (
    VectorStoreIndex,
    StorageContext,
    Settings,
    Document,
    PromptTemplate,
)
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.core.vector_stores import MetadataFilters, ExactMatchFilter
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.llms.openrouter import OpenRouter

from core.embedding import get_embedding_model

SOURCE_DOC_ID_KEY = "source_doc_id"

# ID LENGKAP OpenRouter (dengan suffix ukuran parameter) — versi tanpa
# suffix, atau model yang sudah di-delist (gemma-2-9b, llama-3-8b, dst),
# akan ditolak 400/404. Daftar ini yang sudah teruji jalan per Agustus 2026.
FREE_MODEL_FALLBACK_LIST = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-nano-12b-2-vl:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-20b:free",
    "cohere/north-mini-code:free",
    "s21/s2.1-pro-free:free",
    "ling/ling-3.0-flash:free",
    "poolside/laguna-s-2.1:free",
    "poolside/laguna-xs-2.1:free",
    "openrouter/auto",  # last resort — bukan :free, bisa kena biaya kecil
]

STRICT_QA_TEMPLATE = PromptTemplate(
    "Kamu adalah asisten hukum yang HANYA boleh menjawab berdasarkan potongan "
    "dokumen resmi di bawah ini. JANGAN gunakan pengetahuan umum di luar konteks.\n"
    "---------------------\n{context_str}\n---------------------\n"
    "Kalau jawabannya tidak ada di konteks, jawab persis: "
    "\"Maaf, informasi tersebut tidak ditemukan di dalam dokumen ini.\"\n"
    "Jawab dalam Bahasa Indonesia yang jelas dan terstruktur.\n\nPertanyaan: {query_str}\nJawaban: "
)

STRICT_REFINE_TEMPLATE = PromptTemplate(
    "Jawaban sejauh ini:\n{existing_answer}\n\n"
    "Konteks tambahan (perbaiki jawaban HANYA kalau relevan, jangan mengarang):\n"
    "---------------------\n{context_msg}\n---------------------\n"
    "Pertanyaan: {query_str}\nJawaban yang diperbaiki: "
)

STRICT_CHAT_CONTEXT_PROMPT = (
    "Kamu adalah asisten hukum yang menjawab HANYA berdasarkan potongan dokumen resmi di bawah ini.\n\n"
    "ATURAN JAWABAN:\n"
    "1. Jawab HANYA dari informasi di 'Konteks dokumen' di bawah — jangan mengarang fakta apapun.\n"
    "2. JANGAN PERNAH menyebut istilah seperti 'Existing Answer', 'jawaban sebelumnya', atau membahas "
    "instruksi/format prompt ini ke user — itu instruksi internal untukmu, BUKAN bagian dari isi dokumen "
    "dan BUKAN sesuatu yang user tanyakan.\n"
    "3. Kalau pertanyaan minta daftar/jumlah lengkap (misal 'ada berapa pasal', 'sebutkan semua ketentuan') "
    "dan konteks yang kamu terima cuma sebagian dokumen: jawab LANGSUNG dengan yang kamu temukan, lalu tutup "
    "dengan SATU kalimat singkat saja: 'Ini berdasarkan bagian dokumen yang saya baca, kemungkinan ada bagian "
    "lain yang belum tercakup.' JANGAN berpanjang-panjang menjelaskan keterbatasan ini.\n"
    "4. Kalau informasi benar-benar tidak ada di konteks, jawab persis: 'Maaf, informasi tersebut tidak "
    "ditemukan di dalam dokumen ini.'\n"
    "5. Kalau user minta penjelasan 'lebih detail' dari topik yang sudah dibahas, boleh elaborasi lebih "
    "panjang selama isinya tetap dari konteks yang sama — ini bukan mengarang.\n"
    "6. Jawab dalam Bahasa Indonesia yang jelas, ringkas, terstruktur (pakai list kalau perlu), TIDAK "
    "bertele-tele, dan TIDAK membahas hal di luar yang ditanyakan.\n\n"
    "Konteks dokumen:\n{context_str}"
)


class RAGEngine:
    def __init__(self):
        Settings.embed_model = get_embedding_model()
        self.node_parser = MarkdownNodeParser()

        self.chroma_client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
        self.chroma_collection = self.chroma_client.get_or_create_collection(
            name=config.CHROMA_COLLECTION_NAME
        )
        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)
        self.storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        self.index = VectorStoreIndex.from_vector_store(
            vector_store=self.vector_store,
            storage_context=self.storage_context,
        )

        self._memory_store: dict[str, ChatMemoryBuffer] = {}
        print("[INFO] RAGEngine siap. Koleksi ChromaDB:", config.CHROMA_COLLECTION_NAME)

    def _build_llm(self, model_name: str) -> OpenRouter:
        return OpenRouter(
            api_key=config.OPENROUTER_API_KEY,
            api_base=config.OPENROUTER_BASE_URL,
            model=model_name,
            max_tokens=1024,
            temperature=0.1,
            max_retries=1,
        )

    def _build_filters(self, doc_id: str) -> MetadataFilters | None:
        if not doc_id:
            return None
        return MetadataFilters(filters=[ExactMatchFilter(key=SOURCE_DOC_ID_KEY, value=doc_id)])

    def _extract_page_number(self, text: str, chunk_index: int, total_chunks: int, total_pages: int = 0) -> str:
        """Ekstrak nomor halaman dari teks markdown, atau estimasi dari posisi chunk."""
        patterns = [
            r'Halaman\s+(\d+)',
            r'HALAMAN\s+(\d+)',
            r'---\s*Halaman\s+(\d+)\s*---',
            r'Page\s+(\d+)',
            r'---\s*Page\s+(\d+)\s*---',
            r'^\s*-\s*(\d+)\s*-',
            r'^\s*(\d{1,3})\s*$',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                return f"Halaman {match.group(1)}"

        if total_pages > 0 and total_chunks > 0:
            estimated_page = int((chunk_index / total_chunks) * total_pages) + 1
            return f"Halaman ~{estimated_page}"

        return f"Bagian {chunk_index + 1}"

    def _get_sources_from_response(self, response) -> list[dict]:
        """Ekstrak sumber (halaman + skor relevansi) dari response LlamaIndex."""
        sources = []
        seen_pages = set()

        if hasattr(response, "source_nodes") and response.source_nodes:
            for node in response.source_nodes[:3]:
                metadata = node.node.metadata if hasattr(node, "node") else {}
                page = metadata.get("page_number", "Tidak diketahui")

                if page not in seen_pages:
                    seen_pages.add(page)
                    sources.append({
                        "page": page,
                        "score": round(node.score, 2) if hasattr(node, "score") and node.score else 0,
                    })

        return sources

    def ingest_document(self, markdown_text: str, doc_id: str, metadata: dict = None) -> int:
        metadata = metadata or {}
        metadata[SOURCE_DOC_ID_KEY] = doc_id

        existing = self.chroma_collection.get(where={SOURCE_DOC_ID_KEY: doc_id}, limit=1)
        if existing and existing.get("ids"):
            print(f"[SKIP] Dokumen '{doc_id}' sudah pernah di-ingest, dilewati.")
            return 0

        document = Document(text=markdown_text, metadata=metadata)
        nodes = self.node_parser.get_nodes_from_documents([document])
        total_chunks = len(nodes)

        total_pages = metadata.get("total_pages", 0)
        if total_pages == 0:
            total_pages = max(1, len(markdown_text) // 500)

        for i, node in enumerate(nodes):
            node.metadata["page_number"] = self._extract_page_number(node.text, i, total_chunks, total_pages)
            node.metadata["chunk_index"] = i
            node.metadata["total_chunks"] = total_chunks

        for node in nodes:
            self.index.insert_nodes([node])

        print(f"[INFO] Dokumen '{doc_id}' berhasil di-ingest: {len(nodes)} chunk, ~{total_pages} halaman.")
        return len(nodes)

    def query_document(self, question: str, doc_id: str = None, top_k: int = 8) -> dict:
        """One-shot query TANPA memory percakapan. Return {"answer": str, "sources": [...]}"""
        filters = self._build_filters(doc_id)
        last_error = None

        for model_name in FREE_MODEL_FALLBACK_LIST:
            try:
                Settings.llm = self._build_llm(model_name)
                query_engine = self.index.as_query_engine(
                    similarity_top_k=top_k, filters=filters,
                    text_qa_template=STRICT_QA_TEMPLATE, refine_template=STRICT_REFINE_TEMPLATE,
                )
                response = query_engine.query(question)
                answer = str(response)
                if not answer.strip():
                    raise ValueError("Response kosong dari model.")
                sources = self._get_sources_from_response(response)
                print(f"[INFO] Jawaban (query) dari model: {model_name}")
                return {"answer": answer, "sources": sources}
            except Exception as e:
                print(f"[WARNING] Model '{model_name}' gagal ({type(e).__name__}: {e}), coba model berikutnya...")
                last_error = e
                continue

        raise RuntimeError(f"Semua model fallback gagal. Error terakhir: {last_error}")

    def chat_document(self, question: str, doc_id: str, top_k: int = 10) -> dict:
        """Chat DENGAN memory percakapan. Return {"answer": str, "sources": [...]}"""
        if doc_id not in self._memory_store:
            self._memory_store[doc_id] = ChatMemoryBuffer.from_defaults(token_limit=3000)
        memory = self._memory_store[doc_id]
        filters = self._build_filters(doc_id)

        last_error = None
        for model_name in FREE_MODEL_FALLBACK_LIST:
            try:
                llm = self._build_llm(model_name)
                chat_engine = self.index.as_chat_engine(
                    chat_mode="condense_plus_context", llm=llm, memory=memory,
                    context_prompt=STRICT_CHAT_CONTEXT_PROMPT,
                    similarity_top_k=top_k, filters=filters,
                )
                response = chat_engine.chat(question)
                answer = str(response)
                if not answer.strip():
                    raise ValueError("Response kosong dari model.")
                sources = self._get_sources_from_response(response)
                print(f"[INFO] Jawaban (chat) dari model: {model_name}")
                return {"answer": answer, "sources": sources}
            except Exception as e:
                print(f"[WARNING] Model '{model_name}' gagal ({type(e).__name__}: {e}), coba model berikutnya...")
                last_error = e
                continue

        raise RuntimeError(f"Semua model fallback gagal. Error terakhir: {last_error}")

    def generate_suggested_questions(
        self, doc_id: str, based_on_qa: tuple[str, str] | None = None, count: int = 4
    ) -> list[str]:
        """
        Generate pertanyaan yang disarankan LEWAT LLM berdasarkan isi dokumen
        yang sebenarnya — bukan keyword matching statis — supaya tiap dokumen
        menghasilkan saran yang benar-benar beda dan relevan ke isinya.

        - based_on_qa=None -> pertanyaan STARTER, dibuat dari cuplikan awal dokumen.
        - based_on_qa=(pertanyaan, jawaban) -> pertanyaan FOLLOW-UP dari jawaban terakhir.

        Return list kosong kalau semua model fallback gagal — frontend sebaiknya
        sembunyikan section suggestion (bukan crash) kalau ini kosong.
        """
        filters = self._build_filters(doc_id)

        if based_on_qa:
            prev_question, prev_answer = based_on_qa
            prompt_context = f"Pertanyaan sebelumnya: {prev_question}\nJawaban sebelumnya: {prev_answer}"
            instruction = (
                f"Berdasarkan jawaban di atas, buatkan {count} pertanyaan LANJUTAN yang natural "
                "dan relevan untuk digali lebih dalam dari dokumen ini. Jangan mengulang pertanyaan "
                "yang sama, dan jangan tanya hal yang minta hitungan/daftar lengkap seluruh dokumen "
                "(misal 'ada berapa pasal')."
            )
        else:
            try:
                retriever = self.index.as_retriever(similarity_top_k=10, filters=filters)
                nodes = retriever.retrieve("ringkasan tujuan dan ketentuan utama dokumen ini")
                context_text = "\n\n".join(n.node.get_content()[:600] for n in nodes[:6])
            except Exception:
                context_text = ""
            prompt_context = f"Cuplikan isi dokumen:\n{context_text}"
            instruction = (
                f"Buatkan {count} pertanyaan AWAL yang spesifik dan relevan untuk dokumen hukum ini "
                "(bukan pertanyaan generik yang bisa dipakai untuk semua dokumen apapun isinya).\n"
                "SANGAT PENTING — JANGAN MENEBAK: pertanyaan HANYA boleh tentang topik/istilah yang "
                "BENAR-BENAR muncul secara eksplisit di 'Cuplikan isi dokumen' di atas. JANGAN "
                "mengasumsikan topik yang biasanya ada di dokumen sejenis kalau topik itu tidak "
                "disebut jelas di cuplikan ini (contoh: jangan tanya soal lampu, klakson, atau "
                "komponen spesifik lain kalau kata itu memang tidak muncul di cuplikan). Kalau ragu "
                "apakah suatu topik ada di cuplikan, JANGAN dipakai jadi pertanyaan.\n"
                "Jangan tanya hal yang minta hitungan/daftar lengkap seluruh dokumen (misal 'ada berapa pasal')."
            )

        full_prompt = (
            f"{prompt_context}\n\n{instruction}\n\n"
            f"Balas HANYA dengan JSON array berisi {count} string pertanyaan dalam Bahasa Indonesia, "
            "tanpa teks lain, tanpa markdown code block, tanpa penjelasan. "
            'Contoh format persis: ["Pertanyaan pertama?", "Pertanyaan kedua?"]'
        )

        for model_name in FREE_MODEL_FALLBACK_LIST:
            try:
                llm = self._build_llm(model_name)
                response = llm.complete(full_prompt)
                raw = str(response).strip()
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:].strip()
                questions = json.loads(raw)
                if isinstance(questions, list) and all(isinstance(q, str) and q.strip() for q in questions):
                    return questions[:count]
            except Exception as e:
                print(f"[WARNING] Suggest-questions model '{model_name}' gagal ({type(e).__name__}), coba berikutnya...")
                continue

        return []

    def reset_chat_memory(self, doc_id: str) -> None:
        self._memory_store.pop(doc_id, None)


# Singleton thread-safe — cegah race condition kalau 2 request datang
# bersamaan (misal React Strict Mode memanggil useEffect 2x).
_engine_instance = None
_engine_lock = threading.Lock()


def get_rag_engine() -> RAGEngine:
    global _engine_instance
    if _engine_instance is None:
        with _engine_lock:
            if _engine_instance is None:
                _engine_instance = RAGEngine()
    return _engine_instance