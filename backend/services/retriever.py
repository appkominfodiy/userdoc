import re
import logging
from typing import List, Dict, Any
from services.vectorstore import vectorstore_service

logger = logging.getLogger(__name__)

# Support Pasal Romawi (I, II) dan Arab (9)
PASAL_QUERY_PATTERN = re.compile(r"pasal\s+([IVXLCDM\d]+)", re.IGNORECASE)
# Support Diktum (KESATU, KEDUA, dll)
DIKTUM_QUERY_PATTERN = re.compile(r"\b(kesatu|kedua|ketiga|keempat|kelima|keenam|ketujuh)\b", re.IGNORECASE)

# ---- PERBAIKAN: Deteksi pertanyaan tentang pembukaan (Menimbang/Mengingat) ----
PREAMBLE_KEYWORDS = re.compile(
    r"(latar belakang|menimbang|dasar hukum|mengingat|"
    r"hubungan.*(undang|uu)|"           # "hubungan dengan Undang-Undang" atau "hubungan dengan UU"
    r"(undang|uu).*(disebutkan|dasar)|" # "UU disebutkan" atau "undang-undang dasar"
    r"peraturan.*dasar|alasan.*dikeluarkan|"
    r"pertimbangan|mengapa.*dikeluarkan|tujuan.*diterbitkan)",
    re.IGNORECASE
)


class RetrieverService:
    def __init__(self, k: int = 5):
        self.k = k

    def retrieve(self, document_id: str, question: str, k: int = None) -> List[Dict[str, Any]]:
        if k is None:
            k = self.k

        direct_payload = None
        preamble_payload = None

        # ---- 1. Direct lookup untuk Pasal ----
        match_pasal = PASAL_QUERY_PATTERN.search(question)
        if match_pasal:
            pasal_label = f"Pasal {match_pasal.group(1)}"
            direct_payload = vectorstore_service.find_by_pasal(document_id, pasal_label)
            if direct_payload:
                logger.info(f"Direct lookup pasal: {pasal_label} ditemukan")

        # ---- 2. Direct lookup untuk Diktum ----
        match_diktum = DIKTUM_QUERY_PATTERN.search(question)
        if match_diktum and direct_payload is None:
            label_keyword = match_diktum.group(1).upper()
            direct_payload = vectorstore_service.find_by_label(document_id, label_keyword)
            if direct_payload:
                logger.info(f"Direct lookup diktum: {label_keyword} ditemukan")

        # ---- 3. Direct lookup untuk Pembukaan (Menimbang/Mengingat) ----
        if PREAMBLE_KEYWORDS.search(question):
            logger.info("Pertanyaan terdeteksi tentang pembukaan (Menimbang/Mengingat)")
            # Cari berdasarkan section "pembukaan"
            preamble_payload = vectorstore_service.find_by_section(document_id, "pembukaan")
            if not preamble_payload:
                # Alternatif cari berdasarkan pasal "Pembukaan"
                preamble_payload = vectorstore_service.find_by_pasal(document_id, "Pembukaan")
            if preamble_payload:
                logger.info("Pembukaan ditemukan via direct lookup")
            else:
                logger.warning("Pembukaan TIDAK ditemukan via direct lookup")

        # ---- 4. Similarity search ----
        results = vectorstore_service.similarity_search(document_id, question, k=k)

        # ---- 5. Bangun hasil retrieval ----
        retrieved = []
        for r in results:
            meta = r["metadata"]
            display_label = (
                meta.get("pasal")
                or meta.get("label")
                or meta.get("section")
                or "Bagian dokumen"
            )
            retrieved.append({
                "text": r["text"],
                "pasal": display_label,
                "bab": meta.get("bab"),
                "bagian": meta.get("bagian"),
                "paragraf": meta.get("paragraf"),
                "halaman": meta.get("halaman"),
                "section": meta.get("section"),
                "similarity_score": r["score"],
            })

        # ---- 6. Sisipkan direct payload (pasal/diktum) ----
        if direct_payload:
            direct_entry = {
                "text": direct_payload.get("text", ""),
                "pasal": direct_payload.get("pasal") or direct_payload.get("label"),
                "bab": direct_payload.get("bab"),
                "bagian": direct_payload.get("bagian"),
                "paragraf": direct_payload.get("paragraf"),
                "halaman": direct_payload.get("halaman"),
                "section": direct_payload.get("section"),
                "similarity_score": 1.0,
            }
            retrieved = [r for r in retrieved if r["pasal"] != direct_entry["pasal"]]
            retrieved.insert(0, direct_entry)

        # ---- 7. Sisipkan preamble payload jika ada ----
        if preamble_payload:
            preamble_entry = {
                "text": preamble_payload.get("text", ""),
                "pasal": "Pembukaan (Menimbang & Mengingat)",
                "bab": preamble_payload.get("bab"),
                "bagian": preamble_payload.get("bagian"),
                "paragraf": preamble_payload.get("paragraf"),
                "halaman": preamble_payload.get("halaman", 0),
                "section": "pembukaan",
                "similarity_score": 1.0,
            }
            # Cegah duplikat
            if not any(r.get("pasal") == "Pembukaan (Menimbang & Mengingat)" for r in retrieved):
                if direct_payload:
                    retrieved.insert(1, preamble_entry)
                else:
                    retrieved.insert(0, preamble_entry)
                logger.info("Preamble berhasil disisipkan ke dalam retrieved")

        # ---- 8. Logika Amandemen ----
        amandemen_keywords = ["perubahan", "diubah", "amandemen", "perbedaan", "sebelum", "sesudah", "ubah"]
        if any(kw in question.lower() for kw in amandemen_keywords):
            pasal_i = vectorstore_service.find_by_pasal(document_id, "Pasal I")
            if pasal_i:
                existing = any(r.get("pasal") == "Pasal I" or "Pasal I" in str(r.get("pasal")) for r in retrieved)
                if not existing:
                    preamble = {
                        "text": "[INFORMASI PERUBAHAN (Pasal I)]\n" + pasal_i.get("text", ""),
                        "pasal": "Pasal I (Informasi Perubahan)",
                        "bab": pasal_i.get("bab"),
                        "bagian": pasal_i.get("bagian"),
                        "paragraf": pasal_i.get("paragraf"),
                        "halaman": pasal_i.get("halaman", 0),
                        "section": pasal_i.get("section"),
                        "similarity_score": 1.0,
                    }
                    if direct_payload:
                        retrieved.insert(1, preamble)
                    else:
                        retrieved.insert(0, preamble)

        return retrieved


retriever_service = RetrieverService(k=5)