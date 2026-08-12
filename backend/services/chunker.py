import re
from typing import List, Dict, Any, Optional


# ============================================================
# Helper: perbaiki reading-order yang kadang keliru dari MinerU
# ============================================================

def _reorder_by_reading_position(content_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Urutkan ulang item per halaman berdasarkan posisi vertikal (bbox y0),
    untuk memperbaiki reading-order yang kadang keliru dari MinerU."""
    return sorted(
        content_list,
        key=lambda item: (item.get("page_idx", 0), item.get("bbox", [0, 0, 0, 0])[1])
    )


# ============================================================
# Chunker untuk Peraturan Daerah (BAB -> Bagian -> Paragraf -> Pasal -> Ayat)
# ============================================================

BAB_PATTERN = re.compile(r"^BAB\s+[IVXLCDM]+\s*$", re.IGNORECASE)
BAGIAN_PATTERN = re.compile(r"^Bagian\s+\w+\s*$", re.IGNORECASE)
PARAGRAF_PATTERN = re.compile(r"^Paragraf\s+\d+\s*$", re.IGNORECASE)
# PERBAIKAN: Support Angka Arab (1,2,3) dan Romawi (I, II, III)
PASAL_PATTERN = re.compile(r"^(Pasal\s+[IVXLCDM\d]+)", re.IGNORECASE)
PENJELASAN_PATTERN = re.compile(r"^PENJELASAN\b", re.IGNORECASE)


def _normalize_pasal(raw: str) -> str:
    """Normalisasi label pasal ke bentuk kanonik 'Pasal N' supaya direct
    metadata lookup ('Pasal 9') konsisten -- PDF sering memakai 'PASAL 9'."""
    m = re.match(r"(?i)(pasal)\s+([IVXLCDM\d]+)", raw)
    if m:
        return f"Pasal {m.group(2)}"
    return raw


def chunk_perda(content_list: List[Dict[str, Any]], metadata_base: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Chunking berbasis struktur Perda: BAB -> Bagian -> Paragraf -> Pasal -> Ayat.
    PERBAIKAN: Menyimpan bagian Pembukaan (Menimbang/Mengingat) sebelum Pasal I.
    """
    content_list = _reorder_by_reading_position(content_list)

    chunks = []

    current_bab, current_bab_title = None, None
    current_bagian, current_bagian_title = None, None
    current_paragraf, current_paragraf_title = None, None
    section = "batang_tubuh"
    pending_title_for: Optional[str] = None

    current_pasal = None
    buffer: List[str] = []
    start_page = None
    preamble_saved = False  # <-- FLAG baru untuk menandai pembukaan sudah disimpan

    def bab_label():
        if not current_bab:
            return None
        return f"{current_bab} - {current_bab_title}" if current_bab_title else current_bab

    def bagian_label():
        if not current_bagian:
            return None
        return f"{current_bagian} - {current_bagian_title}" if current_bagian_title else current_bagian

    def paragraf_label():
        if not current_paragraf:
            return None
        return f"{current_paragraf} - {current_paragraf_title}" if current_paragraf_title else current_paragraf

    def flush_pasal():
        if current_pasal is not None and buffer:
            chunks.append({
                **metadata_base,
                "section": section,
                "bab": bab_label(),
                "bagian": bagian_label(),
                "paragraf": paragraf_label(),
                "pasal": current_pasal,
                "halaman": start_page,
                "text": " ".join(buffer).strip(),
            })

    for item in content_list:
        itype = item.get("type")

        if itype == "list":
            list_text = " ".join(item.get("list_items", []))
            if list_text.strip():
                buffer.append(list_text)
            continue

        if itype not in ("text", "header"):
            continue

        text = item.get("text", "").strip()
        if not text:
            continue
        page = item.get("page_idx")

        if pending_title_for:
            if pending_title_for == "bab":
                current_bab_title = text
            elif pending_title_for == "bagian":
                current_bagian_title = text
            elif pending_title_for == "paragraf":
                current_paragraf_title = text
            pending_title_for = None
            continue

        if PENJELASAN_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            section = "penjelasan"
            current_bab, current_bab_title = None, None
            current_bagian, current_bagian_title = None, None
            current_paragraf, current_paragraf_title = None, None
            continue

        if BAB_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_bab, current_bab_title = text, None
            current_bagian, current_bagian_title = None, None
            current_paragraf, current_paragraf_title = None, None
            pending_title_for = "bab"
            continue

        if BAGIAN_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_bagian, current_bagian_title = text, None
            current_paragraf, current_paragraf_title = None, None
            pending_title_for = "bagian"
            continue

        if PARAGRAF_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_paragraf, current_paragraf_title = text, None
            pending_title_for = "paragraf"
            continue

        m_pasal = PASAL_PATTERN.match(text)
        if m_pasal:
            # --- PERBAIKAN: Simpan Pembukaan sebelum Pasal I ---
            if not preamble_saved and buffer:
                chunks.append({
                    **metadata_base,
                    "section": "pembukaan",
                    "pasal": "Pembukaan",
                    "bab": None,
                    "bagian": None,
                    "paragraf": None,
                    "halaman": start_page or page,
                    "text": " ".join(buffer).strip(),
                })
                preamble_saved = True
            # --- Akhir perbaikan ---

            flush_pasal()
            current_pasal = _normalize_pasal(m_pasal.group(1))
            buffer = [text]
            start_page = page
            continue

        buffer.append(text)
        if start_page is None:
            start_page = page

    # Jika dokumen hanya berisi pembukaan (tidak ada Pasal), simpan sebagai pembukaan
    if not preamble_saved and buffer:
        chunks.append({
            **metadata_base,
            "section": "pembukaan",
            "pasal": "Pembukaan",
            "bab": None,
            "bagian": None,
            "paragraf": None,
            "halaman": start_page,
            "text": " ".join(buffer).strip(),
        })
    else:
        flush_pasal()

    return chunks
    """Chunking berbasis struktur Perda: BAB -> Bagian -> Paragraf -> Pasal -> Ayat.

    Unit chunk: satu Pasal (termasuk seluruh ayat di dalamnya).
    Menangani: BAB/Bagian/Paragraf dengan nomor berulang (dibedakan lewat judul),
    section 'batang_tubuh' vs 'penjelasan' (supaya Pasal 9 di dua tempat tidak
    tertimpa), dan item type='list' sebagai lanjutan teks (bukan header baru).
    """
    content_list = _reorder_by_reading_position(content_list)

    chunks = []

    current_bab, current_bab_title = None, None
    current_bagian, current_bagian_title = None, None
    current_paragraf, current_paragraf_title = None, None
    section = "batang_tubuh"
    pending_title_for: Optional[str] = None

    current_pasal = None
    buffer: List[str] = []
    start_page = None

    def bab_label():
        if not current_bab:
            return None
        return f"{current_bab} - {current_bab_title}" if current_bab_title else current_bab

    def bagian_label():
        if not current_bagian:
            return None
        return f"{current_bagian} - {current_bagian_title}" if current_bagian_title else current_bagian

    def paragraf_label():
        if not current_paragraf:
            return None
        return f"{current_paragraf} - {current_paragraf_title}" if current_paragraf_title else current_paragraf

    def flush_pasal():
        if current_pasal is not None and buffer:
            chunks.append({
                **metadata_base,
                "section": section,
                "bab": bab_label(),
                "bagian": bagian_label(),
                "paragraf": paragraf_label(),
                "pasal": current_pasal,
                "halaman": start_page,
                "text": " ".join(buffer).strip(),
            })

    for item in content_list:
        itype = item.get("type")

        if itype == "list":
            list_text = " ".join(item.get("list_items", []))
            if list_text.strip():
                buffer.append(list_text)
            continue

        if itype not in ("text", "header"):
            continue

        text = item.get("text", "").strip()
        if not text:
            continue
        page = item.get("page_idx")

        if pending_title_for:
            if pending_title_for == "bab":
                current_bab_title = text
            elif pending_title_for == "bagian":
                current_bagian_title = text
            elif pending_title_for == "paragraf":
                current_paragraf_title = text
            pending_title_for = None
            continue

        if PENJELASAN_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            section = "penjelasan"
            current_bab, current_bab_title = None, None
            current_bagian, current_bagian_title = None, None
            current_paragraf, current_paragraf_title = None, None
            continue

        if BAB_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_bab, current_bab_title = text, None
            current_bagian, current_bagian_title = None, None
            current_paragraf, current_paragraf_title = None, None
            pending_title_for = "bab"
            continue

        if BAGIAN_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_bagian, current_bagian_title = text, None
            current_paragraf, current_paragraf_title = None, None
            pending_title_for = "bagian"
            continue

        if PARAGRAF_PATTERN.match(text):
            flush_pasal()
            current_pasal, buffer, start_page = None, [], None
            current_paragraf, current_paragraf_title = text, None
            pending_title_for = "paragraf"
            continue

        m_pasal = PASAL_PATTERN.match(text)
        if m_pasal:
            flush_pasal()
            current_pasal = _normalize_pasal(m_pasal.group(1))
            buffer = [text]
            start_page = page
            continue

        buffer.append(text)
        if start_page is None:
            start_page = page

    flush_pasal()
    return chunks


# ============================================================
# Chunker untuk Keputusan (Menimbang/Mengingat/Memperhatikan/Menetapkan
# -> KESATU/KEDUA/KETIGA/dst), termasuk Lampiran (section A/B/C/dst)
# ============================================================

DIKTUM_PATTERN = re.compile(r"^(KESATU|KEDUA|KETIGA|KEEMPAT|KELIMA|KEENAM|KETUJUH)\s*:?", re.IGNORECASE)
SECTION_PATTERN = re.compile(r"^(Menimbang|Mengingat|Memperhatikan|Menetapkan)\s*:?", re.IGNORECASE)
LAMPIRAN_START_PATTERN = re.compile(r"^LAMPIRAN\b", re.IGNORECASE)
LAMPIRAN_SECTION_PATTERN = re.compile(r"^([A-Z])\.\s+(.+)$")


def chunk_keputusan(content_list: List[Dict[str, Any]], metadata_base: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Chunking berbasis struktur Keputusan DPRD/Gubernur:
    Menimbang / Mengingat / Memperhatikan / Menetapkan -> KESATU/KEDUA/dst,
    dan Lampiran (jika ada) -> section huruf A/B/C/dst.

    Unit chunk: satu bagian (Menimbang, dst), satu diktum (KESATU, dst),
    atau satu section Lampiran (A, B, C, dst).
    """
    content_list = _reorder_by_reading_position(content_list)

    chunks = []
    current_section = None
    current_section_title = None
    current_text_buffer = []
    current_page = None
    in_lampiran = False

    def label():
        if in_lampiran and current_section_title:
            return f"Lampiran {current_section} - {current_section_title}"
        return current_section or "unknown"

    def flush():
        if current_text_buffer:
            chunks.append({
                **metadata_base,
                "section": "lampiran" if in_lampiran else (current_section or "unknown"),
                "label": label(),
                "halaman": current_page,
                "text": " ".join(current_text_buffer).strip(),
            })

    for item in content_list:
        itype = item.get("type")

        if itype == "list":
            list_text = " ".join(item.get("list_items", []))
            if list_text.strip():
                current_text_buffer.append(list_text)
            continue

        if itype not in ("text", "header"):
            continue

        text = item.get("text", "").strip()
        if not text:
            continue

        if LAMPIRAN_START_PATTERN.match(text):
            flush()
            in_lampiran = True
            current_section, current_section_title = None, None
            current_text_buffer = [text]
            current_page = item.get("page_idx")
            continue

        if in_lampiran:
            m_section = LAMPIRAN_SECTION_PATTERN.match(text)
            if m_section:
                flush()
                current_section = m_section.group(1)
                current_section_title = m_section.group(2)
                current_text_buffer = [text]
                current_page = item.get("page_idx")
                continue

            current_text_buffer.append(text)
            if current_page is None:
                current_page = item.get("page_idx")
            continue

        is_new_section = SECTION_PATTERN.match(text)
        is_new_diktum = DIKTUM_PATTERN.match(text)

        if is_new_section or is_new_diktum:
            flush()
            current_section = (is_new_section or is_new_diktum).group(1).upper()
            current_text_buffer = [text]
            current_page = item.get("page_idx")
        else:
            current_text_buffer.append(text)
            if current_page is None:
                current_page = item.get("page_idx")

    flush()
    return chunks


# ============================================================
# Router: deteksi jenis dokumen dan pilih chunker yang sesuai
# ============================================================

def detect_document_type(content_list: List[Dict[str, Any]]) -> str:
    """Deteksi jenis dokumen berdasarkan pola struktur yang muncul,
    supaya /ingest bisa otomatis pilih chunker yang tepat tanpa
    campur tangan manual tiap upload."""
    text_blob = " ".join(
        item.get("text", "") for item in content_list if item.get("type") == "text"
    )[:3000]

    # PERBAIKAN: support Pasal dengan angka Romawi (I, II, III)
    if re.search(r"^BAB\s+[IVXLCDM]+", text_blob, re.MULTILINE) or \
       re.search(r"Pasal\s+[IVXLCDM\d]+", text_blob, re.IGNORECASE):
        return "perda"
    if re.search(r"\bKESATU\b", text_blob):
        return "keputusan"
    return "unknown"


# ============================================================
# Generic Chunker yang CERDAS (Fallback)
# ============================================================

GENERIC_HEADING_PATTERN = re.compile(
    r"^(BAB\s+[IVXLCDM]+|Pasal\s+[IVXLCDM\d]+|KESATU|KEDUA|KETIGA|KEEMPAT|KELIMA|"
    r"[A-Z]\.\s|Menimbang|Mengingat|Memperhatikan|Menetapkan)",
    re.IGNORECASE,
)

# Deteksi akhir dari bagian pembukaan (Menimbang/Mengingat)
PREAMBLE_END_PATTERN = re.compile(
    r"^(MEMUTUSKAN|Menetapkan|KESATU|Pasal\s+[IVXLCDM\d]+|BAB\s+[IVXLCDM]+)",
    re.IGNORECASE,
)

MAX_GENERIC_CHUNK_CHARS = 1500


def chunk_generic(content_list: List[Dict[str, Any]], metadata_base: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fallback untuk dokumen yang polanya tidak dikenali chunker spesifik.
    PERBAIKAN: Memisahkan PEMBUKAAN (Menimbang/Mengingat) dari ISI agar pertanyaan
    dasar hukum (UU No. 13/2012) bisa terjawab.
    """
    content_list = _reorder_by_reading_position(content_list)

    chunks = []
    buffer: List[str] = []
    current_label = "Pembukaan"
    current_page = None
    is_preamble = True  # Mulai sebagai pembukaan

    def flush():
        if not buffer:
            return
        text = " ".join(buffer).strip()
        if not text:
            return
        chunks.append({
            **metadata_base,
            "section": "generic",
            "label": current_label,
            "halaman": current_page,
            "text": text,
        })

    for item in content_list:
        itype = item.get("type")

        if itype == "list":
            list_text = " ".join(item.get("list_items", []))
            if list_text.strip():
                buffer.append(list_text)
            continue

        if itype not in ("text", "header"):
            continue

        text = item.get("text", "").strip()
        if not text:
            continue
        page = item.get("page_idx")

        # Jika masih di pembukaan, cek apakah ini akhir pembukaan
        if is_preamble:
            if PREAMBLE_END_PATTERN.search(text):
                # Flush pembukaan terlebih dahulu
                if buffer:
                    flush()
                is_preamble = False
                current_label = text[:60]  # Mulai label baru untuk inti dokumen
                buffer = [text]
                current_page = page
                continue
            else:
                buffer.append(text)
                if current_page is None:
                    current_page = page
                continue

        # --- Di luar pembukaan (inti dokumen) ---
        is_heading = GENERIC_HEADING_PATTERN.search(text)
        buffer_too_long = sum(len(t) for t in buffer) > MAX_GENERIC_CHUNK_CHARS

        if is_heading or buffer_too_long:
            flush()
            if is_heading:
                current_label = text[:60]
            else:
                current_label = f"Bagian {len(chunks) + 1}"
            buffer = [text]
            current_page = page
        else:
            buffer.append(text)
            if current_page is None:
                current_page = page

    # Flush sisa buffer
    if buffer:
        flush()

    return chunks


# ============================================================
# Router Utama
# ============================================================

def chunk_document(content_list: List[Dict[str, Any]], metadata_base: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Router utama -- pilih chunker sesuai jenis dokumen, dengan fallback
    generik kalau chunker spesifik tidak menghasilkan chunk sama sekali
    (struktur tidak dikenali), supaya dokumen tetap bisa dipakai."""
    doc_type = detect_document_type(content_list)
    if doc_type == "perda":
        result = chunk_perda(content_list, metadata_base)
    elif doc_type == "keputusan":
        result = chunk_keputusan(content_list, metadata_base)
    else:
        result = []

    # Jika chunker spesifik gagal menghasilkan chunk, pakai generic
    if not result:
        result = chunk_generic(content_list, metadata_base)

    return result