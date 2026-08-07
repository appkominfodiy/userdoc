from fastapi import APIRouter, UploadFile, File
from core.schemas import UploadResponse
import hashlib 
import uuid, os

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    content = await file.read()
    document_id = hashlib.sha256(content).hexdigest()

    save_path = os.path.join(UPLOAD_DIR, f"{document_id}.pdf")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    if not os.path.exists(save_path):
        with open(save_path, "wb") as f:
            f.write(content)

    return UploadResponse(document_id=document_id, filename=file.filename)