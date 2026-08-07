import httpx
from typing import Dict, Any, Optional
from core.config import settings

JDIH_BASE_URL = "https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/"

COMMON_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://jdih.jogjaprov.go.id",
    "Referer": "https://jdih.jogjaprov.go.id/",
    "secret": settings.jdih_api_secret,
}


class JDIHClient:
    def list_documents(
        self,
        page: int = 1,
        size: int = 10,
        order: str = "-tanggal_pengundangan",
        tahun: Optional[int] = None,
        kategori_hukum_id: Optional[int] = None,
        status_produk_hukum: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        params = {"page": page, "size": size, "order": order}

        # Hanya sertakan parameter yang benar-benar diisi user --
        # supaya "tanpa filter" tetap berfungsi seperti sebelumnya
        if tahun is not None:
            params["tahun"] = tahun
        if kategori_hukum_id is not None:
            params["kategori_hukum_id"] = kategori_hukum_id
        if status_produk_hukum is not None:
            params["status_produk_hukum"] = status_produk_hukum
        if search:
            params["search"] = search  # nama parameter ini masih perlu diverifikasi

        with httpx.Client(timeout=15) as client:
            response = client.get(JDIH_BASE_URL, headers=COMMON_HEADERS, params=params)
            response.raise_for_status()
            return response.json()

    def download_pdf(self, file_url: str) -> bytes:
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            response = client.get(file_url)
            response.raise_for_status()
            return response.content


jdih_client = JDIHClient()