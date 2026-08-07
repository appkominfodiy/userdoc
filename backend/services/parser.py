from pathlib import Path
from typing import List, Dict, Any
from raganything.parser import MineruParser


class DocumentParser:
    def __init__(self):
        self._parser = MineruParser()
        if not self._parser.check_installation():
            raise RuntimeError(
                "MinerU tidak terpasang/terkonfigurasi dengan benar. "
                "Verifikasi manual: jalankan 'mineru --version' di terminal."
            )

    def parse(self, pdf_path: str, output_dir: str = "parsed_output") -> List[Dict[str, Any]]:
        pdf_path = str(Path(pdf_path).resolve())
        content_list = self._parser.parse_pdf(
            pdf_path=pdf_path,
            output_dir=output_dir,
            method="auto",
            backend="pipeline",  
            device="cpu"
        )
        return content_list