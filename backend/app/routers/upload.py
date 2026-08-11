"""
upload.py
=========
Router yang menangani semua hal terkait upload file PDF.
Bertugas: menerima file, validasi, menyimpan ke disk, dan
mengembalikan informasi dasar file (nama, ukuran, jumlah halaman).
"""

import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pypdf import PdfReader

# APIRouter adalah "mini FastAPI" yang bisa kita gabungkan
# ke aplikasi utama nanti. Ini yang memungkinkan kita memecah
# endpoint ke beberapa file terpisah.
router = APIRouter()

# Folder tempat menyimpan file PDF yang diupload.
UPLOAD_DIR = "uploads"

# Batas ukuran file maksimal: 20 MB (dalam satuan byte).
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Menerima satu file PDF dari frontend, memvalidasi, menyimpannya
    ke folder 'uploads/', lalu mengembalikan info dasar file tersebut.

    Parameters:
        file (UploadFile): file yang dikirim melalui form-data dengan key 'file'.
                            FastAPI otomatis mem-parsing file dari request.

    Returns:
        dict: berisi filename, ukuran file (dalam KB), dan jumlah halaman PDF.

    Raises:
        HTTPException 400: jika file bukan PDF atau ukurannya melebihi batas.
    """

    # --- VALIDASI 1: Pastikan file berekstensi .pdf ---
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="File harus berformat PDF (.pdf)"
        )

    # --- Baca seluruh isi file ke memori sebagai bytes ---
    # 'await' dipakai karena membaca file adalah operasi asynchronous
    # (tidak memblokir server saat menunggu file selesai dibaca).
    contents = await file.read()

    # --- VALIDASI 2: Cek ukuran file ---
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Ukuran file melebihi batas maksimal 20MB (ukuran: {file_size / (1024*1024):.2f} MB)"
        )

    # --- Pastikan folder uploads/ ada, kalau belum, buat otomatis ---
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # --- Simpan file ke disk ---
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    # --- Hitung jumlah halaman PDF menggunakan pypdf ---
    try:
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
    except Exception as e:
        # Kalau file rusak / tidak bisa dibaca sebagai PDF,
        # hapus file yang sudah kadung disimpan, lalu beri error jelas.
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail=f"File PDF tidak valid atau rusak: {str(e)}"
        )

    # --- Kembalikan informasi file ke frontend ---
    return {
        "filename": file.filename,
        "size_kb": round(file_size / 1024, 2),
        "num_pages": num_pages,
        "message": "File berhasil diupload"
    }