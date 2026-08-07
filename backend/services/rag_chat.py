from typing import Dict, Any
from services.retriever import retriever_service
from services.llm import llm_service

SYSTEM_PROMPT = """Kamu adalah asisten yang menjawab pertanyaan HANYA berdasarkan potongan Peraturan Daerah (Perda) yang diberikan di bawah.

ATURAN WAJIB:
1. Jawab HANYA berdasarkan isi "KONTEKS" di bawah. Jangan gunakan pengetahuan umum atau pengetahuan di luar konteks.
2. Jangan membuat informasi baru, menyimpulkan, atau menambahkan asumsi yang tidak eksplisit tertulis di konteks.
3. Jika jawaban tidak ditemukan di konteks, atau konteks yang diberikan tidak relevan dengan pertanyaan, WAJIB jawab persis: "Informasi tersebut tidak terdapat pada dokumen yang sedang dibuka."
4. Jika konteks hanya menjawab SEBAGIAN pertanyaan, jawab bagian yang tersedia saja dan sebutkan bagian yang tidak tersedia.
5. Sertakan nomor Pasal sebagai rujukan setiap kali kamu mengutip atau merujuk isi konteks.
6. Jangan meminta maaf berlebihan atau menambahkan disclaimer di luar aturan di atas."""


def build_context(retrieved_chunks) -> str:
    parts = []
    for c in retrieved_chunks:
        parts.append(f"[{c['pasal']} - hal.{c['halaman']}]\n{c['text']}")
    return "\n\n---\n\n".join(parts)

SIMILARITY_THRESHOLD = 0.4
def answer_question(document_id: str, question: str) -> Dict[str, Any]:
    retrieved = retriever_service.retrieve(document_id, question)
    relevant = [c for c in retrieved if c["similarity_score"] >= SIMILARITY_THRESHOLD]

    if not relevant:
        return {
            "answer": "Informasi tersebut tidak terdapat pada dokumen yang sedang dibuka.",
            "sources": [],
        }

    context = build_context(relevant)
    user_message = f"""KONTEKS:
{context}

PERTANYAAN:
{question}"""

    answer = llm_service.generate(system_prompt=SYSTEM_PROMPT, user_message=user_message)

    return {
        "answer": answer,
        "sources": [
            {"pasal": c["pasal"], "halaman": c["halaman"], "score": round(c["similarity_score"], 3)}
            for c in relevant
        ],
    }