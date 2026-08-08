# Chatbot RAG Peraturan Daerah Yogyakarta

Chatbot berbasis Retrieval-Augmented Generation (RAG) untuk membantu masyarakat mencari dan menanyakan isi dokumen hukum Daerah Istimewa Yogyakarta (Peraturan Daerah, Peraturan Gubernur, Keputusan Gubernur) yang bersumber dari JDIH DPRD DIY.

Proyek magang di Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia (DPD RI).

> **Status: dalam pengembangan aktif.** Fitur inti (pencarian dokumen, parsing, chunking, chat) sudah berfungsi, tapi beberapa jenis dokumen dan edge case masih dalam proses penyempurnaan.

## Fitur

- **Pencarian dokumen JDIH** — cari dokumen hukum DIY langsung dari aplikasi (kata kunci, filter tahun/kategori/status, urutan terbaru-terlama), tanpa perlu upload manual.
- **Preview PDF** dengan navigasi halaman dan kontrol zoom.
- **Chatbot tanya-jawab** yang hanya menjawab berdasarkan isi dokumen yang sedang dibuka — jika informasi tidak ada di dokumen, chatbot menyatakan itu secara eksplisit, bukan mengarang jawaban.
- **Sitasi otomatis** — jawaban chatbot menyertakan rujukan (Pasal/Diktum/Lampiran + nomor halaman), dan bisa diklik untuk lompat langsung ke halaman itu di PDF.
- **Riwayat percakapan** tersimpan per-dokumen, bertahan lintas refresh halaman.
- **Deteksi otomatis jenis dokumen** — chunker menyesuaikan strategi pemecahan teks berdasarkan struktur dokumen (Perda dengan BAB/Pasal, Keputusan dengan Diktum KESATU/KEDUA, Lampiran dengan section A/B/C).

## Tech Stack

**Backend**
- Python 3.12, FastAPI
- RAG-Anything + MinerU (ekstraksi PDF)
- BGE-M3 (embedding, via `sentence-transformers`)
- ChromaDB (vector database)
- Groq API (LLM: `openai/gpt-oss-120b`)

**Frontend**
- React + Vite
- TailwindCSS v4
- react-pdf (preview PDF)

**Sumber data**
- JDIH DPRD DIY (`spl.jogjaprov.go.id`) — daftar dan file dokumen hukum resmi

## Struktur Proyek

## Setup

### Backend

```powershell
cd backend
python -m venv ..\venv
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Buat `backend/.env` (lihat `.env.example`), isi:

Jalankan:
```powershell
uvicorn app:app
```

### Frontend

```powershell
cd frontend
npm install
```

Buat `frontend/.env`:

Jalankan:
```powershell
npm run dev
```

## Arsitektur Singkat
User cari dokumen di JDIH browser
↓
Backend unduh PDF dari JDIH 
↓
RAG-Anything/MinerU ekstrak konten 
↓
Deteksi jenis dokumen 
↓
Chunking sesuai struktur dokumen
↓
Embedding (BGE-M3) → ChromaDB (isolasi per-dokumen)
↓
User bertanya → Retrieval (top-k + direct pasal lookup) → Groq LLM → Jawaban + sitasi


## Tahapan Pengembangan

Proyek ini dikembangkan bertahap dari analisis kebutuhan, arsitektur, hingga integrasi penuh, dengan pendekatan verifikasi sebelum lanjut di setiap langkah. Riwayat debugging (kompatibilitas Python, konfigurasi MinerU, isu memori, penanganan multi-jenis dokumen hukum) didokumentasikan sebagai bagian dari proses pembelajaran magang.
