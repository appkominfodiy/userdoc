import re
from typing import Dict, Any
from services.retriever import retriever_service
from services.llm import llm_service
from services.vectorstore import vectorstore_service

SYSTEM_PROMPT = """Anda adalah Asisten Digital Pemerintah Provinsi DIY khusus dokumen hukum.
Gunakan konteks berikut untuk menjawab pertanyaan pengguna.

**ATURAN PENTING:**
1. Jawablah berdasarkan konteks yang diberikan. Jangan gunakan pengetahuan di luar konteks untuk menjawab pertanyaan tentang dokumen.
2. Jika jawaban tidak tersedia dalam konteks, jawab: "Maaf, informasi tersebut tidak terdapat pada dokumen yang sedang dibuka."
3. Jika pengguna memberikan sapaan sederhana ("hai", "halo", "terima kasih"), balas secara natural dan singkat.
4. Jika pertanyaan meminta ringkasan atau isi dokumen secara umum, susun ringkasan poin-poin penting berdasarkan seluruh konteks yang diberikan. Jangan mengatakan informasi tidak tersedia.
5. Jika pertanyaan menanyakan tentang "perubahan", "amandemen", atau "apa yang diubah", dan konteks menyebutkan bagian mana yang diubah (misal: huruf k, l, m) SERTA menyediakan teks baru dari pasal tersebut, maka jelaskan kedua hal tersebut:
   - Sebutkan bagian mana yang diubah (misal: "huruf k, l, dan m diubah").
   - Kutip atau jelaskan isi teks baru tersebut dari konteks yang tersedia.
   JANGAN mengatakan "isi spesifik tidak tercantum" jika teks baru sebenarnya ada dalam konteks."""

def build_context(retrieved_chunks) -> str:
    parts = []
    for c in retrieved_chunks:
        pasal_label = c.get('pasal', '')
        if pasal_label == 'INFORMASI_SISTEM':
            parts.append(c['text'])
        else:
            parts.append(f"[{pasal_label} - hal.{c.get('halaman', '?')}]\n{c['text']}")
    return "\n\n---\n\n".join(parts)

SIMILARITY_THRESHOLD = 0.35

OVERVIEW_PATTERN = re.compile(
    r"(?:apa|isi|jelaskan|sebutkan|tolong)\s+isi\s+(?:dari\s+)?"
    r"(?:dokumen|perda|peraturan|keputusan|uu|undang-?undang)\b"
    r"|(?:ringkas|rangkum|ringkasan|rangkuman|ikhtisar)\b"
    r"|(?:tentang|membahas|mengatur|berisi)\s+apa\b",
    re.IGNORECASE,
)

def answer_question(document_id: str, question: str) -> Dict[str, Any]:
    # ---- CEK APAKAH DOKUMEN ADA DATA ----
    chunk_count = vectorstore_service.get_chunk_count(document_id)
    if chunk_count == 0:
        return {
            "answer": "Dokumen ini belum diproses atau gagal di-parse. Silakan unggah/processing ulang file PDF.",
            "sources": [],
        }

    is_overview = bool(OVERVIEW_PATTERN.search(question))

    if is_overview:
        retrieved = retriever_service.retrieve(document_id, question, k=15)
        relevant = retrieved
    else:
        retrieved = retriever_service.retrieve(document_id, question, k=5)
        relevant = [
            c for c in retrieved
            if c.get("similarity_score") is not None
            and c["similarity_score"] >= SIMILARITY_THRESHOLD
        ]
        # Jika tidak ada yang lolos threshold, ambil 2 teratas
        if not relevant and retrieved:
            relevant = retrieved[:2]

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

    sources = [
        {"pasal": c.get("pasal", "unknown"), "halaman": c.get("halaman", 0), "score": round(c.get("similarity_score", 0), 3)}
        for c in relevant
        if c.get("pasal") != "INFORMASI_SISTEM"
    ]
    if is_overview:
        sources = sources[:8]

    return {
        "answer": answer,
        "sources": sources,
    }