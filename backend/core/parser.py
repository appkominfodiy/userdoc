"""
Modul parsing PDF ke Markdown menggunakan Marker.
Dilengkapi fallback ke PyPDF jika Marker kehabisan memori (MemoryError) atau error lain.
"""

import sys
import threading
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402 (set NLTK_DISABLE_IMPORT_SECURITY duluan)

from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered
from pypdf import PdfReader  # Untuk fallback


class MarkerParser:
    """Wrapper Marker untuk konversi PDF -> Markdown dengan fallback ke PyPDF."""

    def __init__(self):
        print("[INFO] Memuat model Marker... (pertama kali bisa memakan waktu)")
        self.model_dict = create_model_dict()
        self.converter = PdfConverter(artifact_dict=self.model_dict)
        print("[INFO] Model Marker siap digunakan.")

    def convert_pdf_to_markdown(self, pdf_path: Path, save: bool = True) -> dict:
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF tidak ditemukan: {pdf_path}")

        print(f"[INFO] Memproses: {pdf_path.name}")

        method_used = "marker"
        try:
            rendered = self.converter(str(pdf_path))
            markdown_text, _, images = text_from_rendered(rendered)
            print(f"[INFO] Marker berhasil memproses {pdf_path.name}")

        except MemoryError:
            print(f"[WARNING] MemoryError pada Marker (PDF terlalu besar/berat). Fallback ke PyPDF...")
            markdown_text = self._fallback_extract_text(pdf_path)
            method_used = "pypdf_fallback"
        except Exception as e:
            print(f"[WARNING] Error pada Marker: {e}. Fallback ke PyPDF...")
            markdown_text = self._fallback_extract_text(pdf_path)
            method_used = "pypdf_fallback"

        result = {
            "filename": pdf_path.name,
            "markdown_text": markdown_text,
            "markdown_path": None,
            "metadata": {
                "source_pdf": pdf_path.name,
                "method_used": method_used,
            },
        }

        if save:
            md_filename = pdf_path.stem + ".md"
            md_path = config.MARKDOWN_DIR / md_filename
            md_path.write_text(markdown_text, encoding="utf-8")
            result["markdown_path"] = md_path
            print(f"[INFO] Markdown disimpan: {md_path}")

        return result

    def _fallback_extract_text(self, pdf_path: Path) -> str:
        """Ekstraksi teks dasar menggunakan pypdf jika Marker gagal."""
        print(f"[INFO] Mengekstrak teks dasar dari {pdf_path.name}...")
        reader = PdfReader(str(pdf_path))
        text_parts = []

        # Batasi ekstraksi jika halaman terlalu banyak untuk mencegah hang
        max_pages = min(len(reader.pages), 100)

        for i in range(max_pages):
            text = reader.pages[i].extract_text()
            if text:
                text_parts.append(f"--- Halaman {i + 1} ---\n{text}")

        return "\n\n".join(text_parts)

    def convert_folder(self, folder_path: Path = None) -> list[dict]:
        folder_path = Path(folder_path) if folder_path else config.DOCUMENTS_DIR
        pdf_files = list(folder_path.glob("*.pdf"))

        if not pdf_files:
            print(f"[WARNING] Tidak ada file PDF di {folder_path}")
            return []

        results = []
        for pdf_file in pdf_files:
            md_target = config.MARKDOWN_DIR / (pdf_file.stem + ".md")
            if md_target.exists():
                print(f"[SKIP] Sudah pernah diproses: {pdf_file.name}")
                continue
            try:
                result = self.convert_pdf_to_markdown(pdf_file)
                results.append(result)
            except Exception as e:
                print(f"[ERROR] Gagal total memproses {pdf_file.name}: {e}")

        return results


# Singleton thread-safe — double-checked locking supaya model Marker TIDAK
# ke-load 2x kalau 2 request datang bersamaan (misal React Strict Mode di
# frontend yang memanggil useEffect 2x saat development). Tanpa lock ini,
# race condition bisa bikin CPU/RAM penuh mendadak dan memicu timeout ke
# OpenRouter di request lain yang berjalan bersamaan.
_parser_instance = None
_parser_lock = threading.Lock()


def get_parser() -> MarkerParser:
    global _parser_instance
    if _parser_instance is None:
        with _parser_lock:
            if _parser_instance is None:
                _parser_instance = MarkerParser()
    return _parser_instance


if __name__ == "__main__":
    parser = get_parser()
    hasil = parser.convert_folder()
    print(f"[DONE] {len(hasil)} dokumen berhasil dikonversi.")