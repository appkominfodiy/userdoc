import os
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import re   
import json
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.parser import DocumentParser
from services.chunker import chunk_document
from services.embedder import embedding_service
from services.vectorstore import vectorstore_service
from services.retriever import retriever_service

# ============================================================
# Konfigurasi -- ganti path & metadata sesuai dokumen yang diuji
# ============================================================
PDF_PATH = "/pdf/557969071d13a23e131b5ec4652c2b5f6da439501ef2256b8ed74e245d1cd62d"
TEST_DOCUMENT_ID = "test"
METADATA_BASE = {
    "filename": "557969071d13a23e131b5ec4652c2b5f6da439501ef2256b8ed74e245d1cd62d",
    "nomor_perda": "23",
    "tahun": "2026",
}

# ============================================================
# 1. Parsing
# ============================================================
parser = DocumentParser()
result = parser.parse(PDF_PATH)

print(f"Total item: {len(result)}")
print(f"Semua 'type' yang muncul: {set(item.get('type') for item in result)}")

# ============================================================
# 2. Cek pola struktur mentah (BAB/Pasal/Keputusan/Lampiran)
# ============================================================
STRUCTURE_PATTERN = re.compile(
    r"^(BAB\s+[IVXLC]+|Bagian\s+\w+|Paragraf\s+\d+|Pasal\s+\d+|PENJELASAN|"
    r"KESATU|KEDUA|KETIGA|KEEMPAT|KELIMA|LAMPIRAN|^[A-Z]\.\s)",
    re.IGNORECASE,
)
print("\n--- Baris yang cocok pola struktur ---")
for item in result:
    if item.get("type") in ("text", "header"):
        text = item.get("text", "").strip()
        if STRUCTURE_PATTERN.match(text):
            print(f"[page {item.get('page_idx')}, type={item.get('type')}] {text[:70]}")

# ============================================================
# 3. Cek item type='list' (konten yang bisa hilang kalau tidak ditangani)
# ============================================================
list_items = [item for item in result if item.get("type") == "list"]
print(f"\nTotal item type='list': {len(list_items)}")
for item in list_items[:5]:
    print(item)

# ============================================================
# 4. Chunking (otomatis pilih chunk_perda / chunk_keputusan)
# ============================================================
chunks = chunk_document(result, METADATA_BASE)
print(f"\nTotal chunk: {len(chunks)}")

if not chunks:
    print("!! TIDAK ADA CHUNK TERBENTUK -- cek detect_document_type / pola struktur di atas")
else:
    for c in chunks[:5]:
        print(f"[{c.get('pasal') or c.get('section')}] hal.{c.get('halaman')} — {c['text'][:80]}...")

# ============================================================
# 5. Embedding (opsional -- skip kalau cuma mau cek parsing/chunking)
# ============================================================
RUN_EMBEDDING_TEST = False
if RUN_EMBEDDING_TEST and chunks:
    sample_texts = [c["text"] for c in chunks[:3]]
    vectors = embedding_service.embed(sample_texts)
    print(f"\nDimensi vector: {len(vectors[0])}")

# ============================================================
# 6. Simpan ke ChromaDB (opsional)
# ============================================================
RUN_VECTORSTORE_TEST = False
if RUN_VECTORSTORE_TEST and chunks:
    count = vectorstore_service.store_chunks(TEST_DOCUMENT_ID, chunks)
    print(f"\nTersimpan: {count} chunk ke collection '{TEST_DOCUMENT_ID}'")

# ============================================================
# 7. Tes retriever (opsional -- pastikan sudah pernah di-store dulu)
# ============================================================
RUN_RETRIEVER_TEST = False
if RUN_RETRIEVER_TEST:
    test_queries = [
        "pasal 3 isinya apa",
        "apa sanksi jika melanggar ketentuan ini",
    ]
    for q in test_queries:
        print(f"\nQuery: {q!r}")
        try:
            results = retriever_service.retrieve(TEST_DOCUMENT_ID, q)
            for r in results:
                label = r.get("pasal") or r.get("section")
                print(f"  [{label}] score={r['similarity_score']:.3f} hal.{r['halaman']} — {r['text'][:80]}")
        except Exception as e:
            print(f"  (gagal query: {e})")

for c in chunks:
    label_display = c.get('label') or c.get('pasal') or c.get('section')
    print(f"[{label_display}] hal.{c.get('halaman')} — panjang: {len(c['text'])} karakter")

VERIFY_PATTERN = re.compile(
    r"^(Menimbang|Mengingat|MEMUTUSKAN|Menetapkan|Pasal\s+[IVX]+\s*$|Pasal\s+\d+\s*$|^\d+\.\s)",
    re.IGNORECASE,
)
print("\n--- Baris yang cocok pola Peraturan Perubahan ---")
for item in result:
    if item.get("type") in ("text", "header"):
        text = item.get("text", "").strip()
        if VERIFY_PATTERN.match(text):
            print(f"[page {item.get('page_idx')}, type={item.get('type')}] {text[:80]}")