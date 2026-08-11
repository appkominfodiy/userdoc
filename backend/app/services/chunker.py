"""
chunker.py
==========
Berisi logika untuk memecah teks panjang (per halaman) menjadi
potongan-potongan kecil (chunk) yang siap di-embedding.

Kenapa perlu chunking? Karena LLM punya batas panjang teks yang bisa
diproses sekaligus, dan kita ingin retrieval (pencarian) yang presisi -
hanya mengambil bagian teks yang relevan dengan pertanyaan user, bukan
seluruh dokumen.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_pages(pages: list[dict], chunk_size: int = 500, chunk_overlap: int = 50) -> list[dict]:
    """
    Memecah teks dari setiap halaman menjadi potongan-potongan kecil (chunk),
    sambil tetap mempertahankan informasi halaman asal setiap chunk.

    Parameters:
        pages (list[dict]): hasil dari extract_text_from_pdf(), format:
                             [{"page_number": 1, "text": "..."}, ...]
        chunk_size (int): jumlah karakter maksimal per chunk. Default 500.
                           Semakin besar, semakin banyak konteks per chunk,
                           tapi kurang presisi saat pencarian.
        chunk_overlap (int): jumlah karakter yang "tumpang tindih" antara
                              chunk yang berurutan. Default 50. Ini mencegah
                              informasi terpotong kehilangan konteks di
                              perbatasan chunk.

    Returns:
        list[dict]: list of chunk, masing-masing berformat:
            {
                "chunk_id": 1,
                "page_number": 3,
                "text": "isi chunk..."
            }
    """
    # RecursiveCharacterTextSplitter mencoba memotong teks secara "pintar":
    # dia akan coba potong di batas paragraf ("\n\n") dulu, kalau chunk masih
    # kepanjangan baru coba di batas kalimat, lalu kata, dan terakhir baru
    # potong paksa per karakter. Ini menghindari kata/kalimat terpotong aneh.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],  # urutan prioritas pemotongan
    )

    all_chunks = []
    chunk_id_counter = 1

    # Proses tiap halaman SATU PER SATU (bukan digabung semua dulu),
    # supaya kita tetap tahu chunk ini berasal dari halaman berapa.
    for page in pages:
        page_number = page["page_number"]
        text = page["text"]

        # Kalau teks halaman ini kosong (misal halaman scan/gambar),
        # tidak perlu di-chunk, langsung skip.
        if not text.strip():
            continue

        # split_text() mengembalikan list of string (potongan-potongan teks)
        page_chunks = splitter.split_text(text)

        for chunk_text in page_chunks:
            all_chunks.append({
                "chunk_id": chunk_id_counter,
                "page_number": page_number,
                "text": chunk_text
            })
            chunk_id_counter += 1

    return all_chunks