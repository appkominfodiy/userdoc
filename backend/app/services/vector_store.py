"""
vector_store.py
================
Modul yang bertanggung jawab untuk:
1. Mengubah teks chunk menjadi vector embedding (menggunakan Sentence Transformers)
2. Menyimpan vector tersebut ke ChromaDB
3. (Nanti di Tahap 7) melakukan pencarian kemiripan (similarity search)

Ini adalah "otak" dari sistem RAG kita - tempat makna teks direpresentasikan
sebagai angka yang bisa dibandingkan secara matematis.
"""

import chromadb
from sentence_transformers import SentenceTransformer

# --- Muat model embedding SEKALI SAJA saat modul ini di-import ---
# "paraphrase-multilingual-MiniLM-L12-v2" dipilih karena performa yang 
# lebih baik untuk bahasa Indonesia dibandingkan dengan versi bahasa Inggris.
# Model ini akan didownload otomatis saat pertama kali dijalankan.
embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# --- Setup ChromaDB ---
# PersistentClient artinya data akan DISIMPAN ke disk (folder chroma_db/),
# bukan hanya di memori. Jadi kalau server di-restart, data tidak hilang.
chroma_client = chromadb.PersistentClient(path="chroma_db")

# "Collection" di ChromaDB itu seperti "tabel" di database biasa.
# get_or_create_collection artinya: kalau collection ini sudah ada, pakai
# yang sudah ada; kalau belum, buat baru. Ini mencegah error kalau
# fungsi ini dipanggil berkali-kali.
collection = chroma_client.get_or_create_collection(name="pdf_chunks")


def embed_and_store_chunks(chunks: list[dict], filename: str) -> int:
    """
    Mengubah setiap chunk teks menjadi vector embedding, lalu menyimpannya
    ke ChromaDB beserta metadata (nama file, nomor halaman).

    Parameters:
        chunks (list[dict]): hasil dari chunk_pages(), format:
                              [{"chunk_id": 1, "page_number": 1, "text": "..."}, ...]
        filename (str): nama file PDF asal chunk-chunk ini, contoh "SOP.pdf".
                         Dipakai sebagai metadata agar nanti kita tahu chunk
                         ini berasal dari dokumen mana.

    Returns:
        int: jumlah chunk yang berhasil disimpan ke ChromaDB.
    """
    if not chunks:
        return 0

    # Kumpulkan teks semua chunk dalam satu list, supaya bisa di-embed
    # sekaligus (lebih efisien daripada satu-satu).
    texts = [chunk["text"] for chunk in chunks]

    # --- Proses embedding: ubah semua teks jadi vector angka ---
    # Hasilnya berupa array 2D: setiap baris adalah 1 vector untuk 1 chunk.
    embeddings = embedding_model.encode(texts).tolist()

    # --- Siapkan ID unik untuk setiap chunk di ChromaDB ---
    # ID harus unik SECARA GLOBAL di collection, bukan cuma unik per file.
    # Maka kita gabungkan nama file + chunk_id, contoh: "SOP.pdf_chunk_1"
    ids = [f"{filename}_chunk_{chunk['chunk_id']}" for chunk in chunks]

    # --- Siapkan metadata untuk setiap chunk ---
    # Metadata ini yang nanti dipakai untuk SOURCE CITATION
    # ("Sumber: SOP.pdf, Halaman 7")
    metadatas = [
        {
            "filename": filename,
            "page_number": chunk["page_number"],
            "chunk_id": chunk["chunk_id"],
        }
        for chunk in chunks
    ]

    # --- Simpan semuanya ke ChromaDB dalam satu operasi ---
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,       # teks asli disimpan juga, supaya nanti
                                # bisa langsung diambil tanpa perlu decode ulang
        metadatas=metadatas,
    )

    return len(chunks)


def get_collection_stats() -> dict:
    """
    Mengambil informasi ringkas tentang isi ChromaDB saat ini.
    Berguna untuk STATUS PANEL nanti (jumlah chunk tersimpan, dll).

    Returns:
        dict: berisi total jumlah chunk yang tersimpan di collection.
    """
    return {
        "total_chunks_stored": collection.count()
    }

def search_similar_chunks(query: str, top_k: int = 3) -> list[dict]:
    """
    Mencari chunk-chunk yang paling mirip secara makna dengan query
    (pertanyaan) yang diberikan.

    Proses:
    1. Ubah query (teks pertanyaan) jadi vector, menggunakan model
       embedding YANG SAMA dengan yang dipakai saat menyimpan chunk
       (wajib sama, supaya bisa dibandingkan secara adil).
    2. Minta ChromaDB mencari top_k chunk dengan vector paling mirip.
    3. Susun hasilnya jadi format yang mudah dipakai di tahap berikutnya.

    Parameters:
        query (str): pertanyaan/teks dari user, contoh:
                      "Berapa lama proses cuti tahunan?"
        top_k (int): jumlah chunk paling relevan yang ingin diambil.
                      Default 3. Semakin besar, semakin banyak konteks
                      yang dikirim ke LLM nanti (tapi juga makin "berat").

    Returns:
        list[dict]: list chunk paling relevan, terurut dari yang PALING
                     mirip ke yang KURANG mirip. Format tiap item:
            {
                "text": "isi chunk...",
                "filename": "SOP.pdf",
                "page_number": 7,
                "similarity_score": 0.89   # semakin dekat ke 1.0, semakin mirip
            }
    """
    # Kalau belum ada chunk sama sekali di database, langsung kembalikan
    # list kosong (menghindari error saat query ke collection kosong).
    if collection.count() == 0:
        return []

    # --- Ubah query jadi vector, pakai model YANG SAMA ---
    query_embedding = embedding_model.encode([query]).tolist()

    # --- Minta ChromaDB mencari chunk paling mirip ---
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
    )

    # --- Susun hasil jadi format yang rapi ---
    # ChromaDB mengembalikan hasil dalam bentuk list-of-list (karena bisa
    # menerima banyak query sekaligus), tapi kita cuma kirim 1 query,
    # jadi kita ambil index [0] saja.
    formatted_results = []

    documents = results["documents"][0]      # teks asli tiap chunk
    metadatas = results["metadatas"][0]       # filename & page_number
    distances = results["distances"][0]       # jarak (semakin kecil = semakin mirip)

    for doc, meta, distance in zip(documents, metadatas, distances):
        # ChromaDB secara default mengembalikan "distance" (jarak), bukan
        # "similarity" (kemiripan). Kita ubah jadi similarity score yang
        # lebih intuitif: semakin dekat ke 1.0 = semakin mirip.
        # Formula ini cocok untuk distance metric cosine yang dipakai ChromaDB.
        similarity_score = 1 - distance

        formatted_results.append({
            "text": doc,
            "filename": meta["filename"],
            "page_number": meta["page_number"],
            "similarity_score": round(similarity_score, 4),
        })

    return formatted_results