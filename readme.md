# Chatbot RAG JDIH DIY

Aplikasi web untuk membaca dan bertanya jawab langsung dengan dokumen hukum resmi
dari **JDIH (Jaringan Dokumentasi dan Informasi Hukum) Daerah Istimewa Yogyakarta**,
menggunakan pendekatan **RAG (Retrieval-Augmented Generation)**.

Setiap dokumen hukum (Peraturan Gubernur, Keputusan Gubernur, Peraturan Daerah, dll.)
bisa dibuka langsung dari daftar, dibaca dalam PDF viewer, dan ditanyai isinya lewat
chatbot yang jawabannya **hanya berdasarkan isi dokumen tersebut** — bukan mengarang
atau menjawab dari pengetahuan umum di luar dokumen.

## Cara Kerja (Arsitektur RAG)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   API JDIH DIY   │────▶│   Backend (FastAPI)   │◀───▶│ Frontend (Next.js) │
│  (sumber data)   │     │                       │     │                    │
└─────────────────┘     │  1. Marker            │     └─────────────────┘
                         │     (parsing PDF→MD)  │
                         │  2. SentenceTransformer│
                         │     (embedding lokal)  │
                         │  3. ChromaDB           │
                         │     (vector database)  │
                         │  4. LlamaIndex          │
                         │     (RAG orchestration) │
                         │  5. OpenRouter LLM      │
                         │     (jawab pertanyaan)  │
                         └──────────────────────┘
```

**Alur singkatnya:**
1. Daftar dokumen diambil dari API JDIH DIY.
2. Saat sebuah dokumen dibuka pertama kali: PDF-nya diunduh, lalu diproses oleh
   **Marker** (mengubah PDF — termasuk hasil scan/OCR — menjadi teks Markdown yang rapi).
3. Teks Markdown dipecah jadi potongan (chunk) dan diubah jadi vektor menggunakan
   **embedding model lokal** (`sentence-transformers/all-MiniLM-L6-v2`) — proses ini
   100% gratis dan berjalan di komputer sendiri, tidak memanggil API berbayar apapun.
4. Vektor disimpan di **ChromaDB** (vector database lokal, tersimpan di folder
   `chroma_db/`).
5. Saat user bertanya di chatbot, sistem mencari potongan teks yang paling relevan
   dari ChromaDB, lalu mengirim potongan itu + pertanyaan ke **LLM gratis via
   OpenRouter** untuk dirangkai jadi jawaban. LLM diinstruksikan ketat untuk hanya
   menjawab dari potongan teks yang diberikan.

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Parsing PDF | [Marker](https://github.com/datalab-to/marker) (dengan fallback ke `pypdf` kalau memori tidak cukup) |
| RAG Framework | [LlamaIndex](https://www.llamaindex.ai/) |
| Embedding | `sentence-transformers/all-MiniLM-L6-v2` (lokal, gratis) |
| Vector Database | [ChromaDB](https://www.trychroma.com/) |
| LLM | [OpenRouter](https://openrouter.ai/) (multi-model fallback, model gratis) |
| Backend API | [FastAPI](https://fastapi.tiangolo.com/) |
| Frontend | [Next.js 15](https://nextjs.org/) (App Router, TypeScript, Tailwind CSS) |
| PDF Viewer | [react-pdf](https://github.com/wojtekmaj/react-pdf) |

## Struktur Folder

```
jdih-llamaindex/
├── backend/
│   ├── api/
│   │   └── main.py            # Endpoint FastAPI
│   ├── core/
│   │   ├── parser.py          # Marker: PDF → Markdown
│   │   ├── embedding.py       # Embedding lokal
│   │   └── rag_engine.py      # LlamaIndex: ingest, chat, suggested questions
│   ├── services/
│   │   └── jdih_api.py        # Client ke API JDIH DIY
│   ├── documents/             # PDF yang sudah diunduh (auto-generate)
│   ├── markdown_docs/         # Hasil parsing Markdown (auto-generate)
│   ├── chroma_db/             # Vector database (auto-generate)
│   ├── config.py
│   ├── requirements.txt
│   └── .env                   # API key & konfigurasi (JANGAN di-commit)
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                    # Halaman daftar dokumen
    │   │   └── documents/[id]/page.tsx     # Halaman baca + chat
    │   ├── components/
    │   ├── lib/api.ts                      # Fungsi fetch ke backend
    │   └── types/document.ts
    └── .env.local                          # URL backend (JANGAN di-commit)
```

## Prasyarat

Sebelum mulai, pastikan sudah terinstall:
- **Python 3.10 atau 3.11** ([python.org](https://www.python.org/downloads/))
- **Node.js 18+** dan npm ([nodejs.org](https://nodejs.org/))
- **Git** ([git-scm.com](https://git-scm.com/))
- Akun **OpenRouter** untuk API key gratis ([openrouter.ai](https://openrouter.ai/))

> **Catatan Windows:** taruh project ini di path yang pendek dan **bukan di dalam
> folder `Downloads`** (misal `C:\jdih-llamaindex`) — beberapa software keamanan
> Windows memblokir proses Python yang berjalan dari folder Downloads.

## Instalasi Backend

```bash
cd backend

# Buat virtual environment
python -m venv venv

# Aktifkan venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install semua dependency
pip install -r requirements.txt
```

Buat file `.env` di dalam folder `backend/`:

```env
OPENROUTER_API_KEY=isi_dengan_api_key_kamu
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
JDIH_API_BASE_URL=https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/
```

Jalankan server backend:

```bash
uvicorn api.main:app --reload --port 8000
```

Backend siap di `http://localhost:8000`. Buka `http://localhost:8000/docs` untuk
melihat dan mencoba semua endpoint API secara interaktif (Swagger UI bawaan FastAPI).

> **Catatan pertama kali jalan:** proses download model Marker (untuk parsing PDF)
> dan model embedding bisa memakan waktu beberapa menit — ini normal, cuma terjadi
> sekali di awal (model tersimpan di cache lokal setelahnya).

## Instalasi Frontend

Buka terminal baru (biarkan backend tetap jalan di terminal sebelumnya):

```bash
cd frontend
npm install
```

Buat file `.env.local` di dalam folder `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Jalankan server frontend:

```bash
npm run dev
```

Buka `http://localhost:3000` di browser.

## Menjalankan Keduanya

Setiap kali mau develop, jalankan **2 terminal terpisah**:

```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate          # Windows
uvicorn api.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

## Fitur

- 📚 Daftar dokumen hukum JDIH DIY dengan filter kategori, tahun, dan pencarian, lengkap dengan pagination
- 📄 PDF viewer per-halaman langsung di browser
- 💬 Chatbot tanya-jawab per dokumen, dengan memori percakapan (mendukung pertanyaan lanjutan seperti "jelaskan lebih detail")
- 🎯 Jawaban selalu disertai referensi halaman sumber di dokumen
- 🤖 Pertanyaan yang disarankan (starter & follow-up) dibuat otomatis oleh AI berdasarkan isi dokumen yang sedang dibuka
- 🔄 Fallback otomatis ke beberapa model LLM gratis kalau satu model sedang rate-limited
- 🚫 Anti-halusinasi: chatbot menolak menjawab kalau informasinya memang tidak ada di dokumen

## Troubleshooting Umum

| Masalah | Solusi |
|---|---|
| `ImportError: Blocked import ... for security reasons` | Fitur keamanan NLTK — pastikan `config.py` sudah set `NLTK_DISABLE_IMPORT_SECURITY=1` di baris paling atas |
| Semua model LLM gagal (`RateLimitError` semua) | Model gratis OpenRouter share limit harian antar semua pengguna — tunggu beberapa saat atau coba lagi nanti |
| `Fatal error in launcher` setelah pindah folder | `venv` menyimpan path absolut — hapus folder `venv/` dan buat ulang (`python -m venv venv`) di lokasi baru |
| PDF gagal diproses (`MemoryError`) | Otomatis fallback ke ekstraksi teks dasar via `pypdf` (kualitas parsing lebih sederhana, tapi tetap bisa dipakai) |

## Kontributor

Dikembangkan sebagai bagian dari program magang di **Dinas Komunikasi dan
Informatika Daerah Istimewa Yogyakarta (Kominfo DIY)**.