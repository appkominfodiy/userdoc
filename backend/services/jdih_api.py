"""
Service untuk fetch daftar dokumen dari API JDIH DIY dan download PDF-nya.
Dilengkapi dengan User-Agent dan Timeout yang robust agar tidak hang.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402

import httpx


class JDIHAPIClient:
    """Client untuk berkomunikasi dengan API JDIH DIY."""

    def __init__(self):
        self.base_url = config.JDIH_API_BASE_URL.rstrip("/")
        
        # Tambahkan User-Agent agar tidak diblokir/firewalled oleh server target
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }
        
        # Timeout yang lebih cerdas: 10 detik untuk connect, 30 detik untuk membaca data
        timeout = httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0)
        
        self.client = httpx.Client(
            headers=headers,
            timeout=timeout,
            # verify=True adalah default, biarkan saja untuk keamanan SSL
        )

    def get_document_list(self, page: int = 1, page_size: int = 20) -> list[dict]:
        try:
            response = self.client.get(
                self.base_url,
                params={"page": page, "size": page_size, "order": "-tanggal_pengundangan"},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("success"):
                documents = data.get("data", [])
                print(f"[INFO] Berhasil ambil {len(documents)} dokumen (halaman {page}).")
                return documents
            else:
                print(f"[ERROR] API mengembalikan success=false")
                return []

        except httpx.TimeoutException:
            print("[WARNING] Timeout: Server JDIH terlalu lambat merespons. Coba lagi nanti.")
            return []
        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP error saat fetch daftar dokumen: {e}")
            return []
        except httpx.RequestError as e:
            print(f"[ERROR] Gagal konek ke API JDIH: {e}")
            return []

    def get_document_detail(self, slug: str) -> dict | None:
        try:
            response = self.client.get(f"{self.base_url}/{slug}")
            response.raise_for_status()
            data = response.json()

            if data.get("success"):
                detail = data.get("data", {})
                print(f"[INFO] Detail dokumen berhasil diambil: {detail.get('judul_peraturan', 'Unknown')[:50]}...")
                return detail
            else:
                print(f"[ERROR] Gagal ambil detail untuk slug: {slug}")
                return None

        except httpx.TimeoutException:
            print("[WARNING] Timeout saat mengambil detail dokumen.")
            return None
        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP error saat fetch detail: {e}")
            return None
        except httpx.RequestError as e:
            print(f"[ERROR] Gagal konek saat fetch detail: {e}")
            return None

    def download_pdf(self, pdf_url: str, filename: str, save_dir: Path = None) -> Path | None:
        save_dir = save_dir or config.DOCUMENTS_DIR
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / filename

        if save_path.exists():
            print(f"[SKIP] '{filename}' sudah pernah didownload.")
            return save_path

        try:
            # Gunakan timeout yang lebih panjang untuk download file besar
            with self.client.stream("GET", pdf_url, timeout=60.0) as response:
                response.raise_for_status()
                with open(save_path, "wb") as f:
                    for chunk in response.iter_bytes(chunk_size=8192):
                        f.write(chunk)

            print(f"[INFO] PDF disimpan: {save_path}")
            return save_path

        except httpx.TimeoutException:
            print(f"[WARNING] Timeout saat download '{filename}'.")
            return None
        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP error saat download '{filename}': {e}")
            return None
        except httpx.RequestError as e:
            print(f"[ERROR] Gagal download '{filename}': {e}")
            return None

    def close(self):
        self.client.close()


_client_instance = None


def get_jdih_client() -> JDIHAPIClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = JDIHAPIClient()
    return _client_instance