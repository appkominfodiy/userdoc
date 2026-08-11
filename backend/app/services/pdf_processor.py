"""
pdf_processor.py
=================
Berisi logika inti untuk membaca isi teks dari file PDF dan
membersihkannya agar siap diproses ke tahap selanjutnya (chunking, embedding).

Modul ini TIDAK berurusan dengan HTTP request/response - itu tugas router.
Modul ini murni fokus pada "logika dapur": baca PDF, bersihkan teks.
"""

import re
from pypdf import PdfReader


def clean_text(text: str) -> str:
    """
    Membersihkan teks mentah hasil ekstraksi PDF agar lebih rapi.

    Proses pembersihan:
    1. Menghapus karakter form-feed (\x0c) yang muncul di akhir halaman PDF.
    2. Mengganti banyak spasi/baris baru berturut-turut menjadi satu spasi.
    3. Menghapus spasi di awal dan akhir teks.

    Parameters:
        text (str): teks mentah hasil ekstraksi dari satu halaman PDF.

    Returns:
        str: teks yang sudah lebih bersih dan rapi.
    """
    # Hapus karakter form-feed (penanda akhir halaman di PDF)
    text = text.replace("\x0c", " ")

    # Ganti SEMUA jenis whitespace berlebihan (spasi ganda, tab, baris baru
    # berturut-turut) menjadi satu spasi tunggal.
    # \s+ artinya "satu atau lebih karakter whitespace apapun"
    text = re.sub(r"\s+", " ", text)

    # Hapus spasi di awal/akhir string
    text = text.strip()

    return text


def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Membaca seluruh halaman dari file PDF, mengekstrak teksnya,
    membersihkannya, dan mengembalikan hasil per halaman.

    Struktur per-halaman ini SANGAT PENTING karena nanti dipakai untuk
    fitur "source citation" - supaya chatbot bisa bilang
    "jawaban ini dari halaman 7", bukan cuma "dari dokumen ini" saja.

    Parameters:
        file_path (str): path menuju file PDF yang akan dibaca,
                          contoh: "uploads/SOP.pdf".

    Returns:
        list[dict]: list berisi dictionary per halaman, dengan format:
            [
                {"page_number": 1, "text": "isi halaman 1 yang sudah bersih..."},
                {"page_number": 2, "text": "isi halaman 2 yang sudah bersih..."},
                ...
            ]
            Halaman yang teksnya kosong (misal halaman gambar/scan) akan
            tetap dimasukkan, tapi teksnya jadi string kosong "".
    """
    reader = PdfReader(file_path)
    pages_content = []

    # enumerate(..., start=1) supaya penomoran halaman dimulai dari 1,
    # bukan dari 0 (lebih natural, sesuai yang manusia baca di PDF viewer)
    for page_number, page in enumerate(reader.pages, start=1):
        # extract_text() adalah fungsi bawaan pypdf untuk menarik teks
        # dari satu halaman PDF.
        raw_text = page.extract_text() or ""  # fallback ke "" kalau None

        cleaned = clean_text(raw_text)

        pages_content.append({
            "page_number": page_number,
            "text": cleaned
        })

    return pages_content