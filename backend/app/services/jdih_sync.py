import os
import requests
from app.services.pdf_processor import extract_text_from_pdf
from app.services.chunker import chunk_pages
from app.services.vector_store import embed_and_store_chunks

LIST_API = "https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/"
DETAIL_API = "https://spl.jogjaprov.go.id/jdih-etalase/public/produk-hukum/"

HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    'secret': 'babfedd77e13e73058ed92c9f1da0cbf0c1298056d5d4de1a2cb6a5fa471bb0ec5eb302b81351269c390b476605d015cf3d7deaeec40675a637bb8a13ac8cc76c72907e0d6d99c5910389c141afe988576df5bc4b297893ccb90d6974c1eb5d21cd77567acaa83b730d0eb71c3f09e94a2ed6d57c396345df21da2afa31832d5abb71c07e200af96ab3eee927cd3c056db15f7de47b8cba9a9466a61902378b0901db192df46333855bb03e904e30eb89407b62cd83abbcca2ecf6aa14249835a75a7a3b338556ed751f81da4602329b082135c53fd0b95d24a79fcf383bb02652159190eee7714bb43aa8f4182d9ac8a2d8dc3933bd9ddc84db6aa0069facb2'
}

def sync_jdih_documents(page=1, size=10):
    list_url = f"{LIST_API}?page={page}&size={size}&order=-tanggal_pengundangan"
    res = requests.get(list_url, headers=HEADERS)
    if res.status_code != 200:
        raise Exception(f"Failed to fetch JDIH list: {res.status_code} {res.text}")
    
    data = res.json()
    items = data.get("data", {}).get("items", [])
    if not items:
        return {"status": "no data", "processed_count": 0}
    
    processed_count = 0
    os.makedirs("uploads", exist_ok=True)
    
    for item in items:
        slug = item.get("slug")
        if not slug:
            continue
            
        detail_url = f"{DETAIL_API}{slug}"
        detail_res = requests.get(detail_url, headers=HEADERS)
        if detail_res.status_code != 200:
            continue
            
        detail_data = detail_res.json()
        item_data = detail_data.get("data", {})
        file_url = item_data.get("file_peraturan")
        if not file_url:
            continue
            
        filename = file_url.split("/")[-1]
        save_path = os.path.join("uploads", filename)
        
        # Skip if already exists
        if os.path.exists(save_path):
            continue
            
        print(f"Downloading {filename}...")
        pdf_res = requests.get(file_url, headers=HEADERS)
        if pdf_res.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(pdf_res.content)
                
            try:
                pages = extract_text_from_pdf(save_path)
                chunks = chunk_pages(pages)
                embed_and_store_chunks(chunks, filename)
                processed_count += 1
                print(f"Successfully processed {filename}")
            except Exception as e:
                print(f"Failed to process {filename}: {e}")
                
    return {"status": "success", "processed_count": processed_count}

def sync_single_document(slug: str) -> dict:
    """
    Downloads and analyzes a single document based on its slug.
    Skips if already processed.
    """
    detail_url = f"{DETAIL_API}{slug}"
    detail_res = requests.get(detail_url, headers=HEADERS)
    if detail_res.status_code != 200:
        return {"status": "error", "message": f"Failed to fetch document detail. HTTP {detail_res.status_code}"}
        
    detail_data = detail_res.json()
    item_data = detail_data.get("data", {})
    file_url = item_data.get("file_peraturan")
    
    if not file_url:
        return {"status": "error", "message": "No PDF file available for this document."}
        
    filename = file_url.split("/")[-1]
    os.makedirs("uploads", exist_ok=True)
    save_path = os.path.join("uploads", filename)
    
    # Check if we already processed it (assume if file exists, it's in vector DB)
    if os.path.exists(save_path):
        return {"status": "success", "message": "Document already analyzed and cached.", "filename": filename}
        
    print(f"[Single Sync] Downloading {filename}...")
    pdf_res = requests.get(file_url, headers=HEADERS)
    if pdf_res.status_code != 200:
        return {"status": "error", "message": f"Failed to download PDF. HTTP {pdf_res.status_code}"}
        
    with open(save_path, "wb") as f:
        f.write(pdf_res.content)
        
    try:
        pages = extract_text_from_pdf(save_path)
        chunks = chunk_pages(pages)
        embed_and_store_chunks(chunks, filename)
        return {"status": "success", "message": "Document downloaded and analyzed successfully.", "filename": filename}
    except Exception as e:
        # If extraction fails, remove the partial file so it can be retried later
        if os.path.exists(save_path):
            os.remove(save_path)
        return {"status": "error", "message": f"Failed to process document: {str(e)}"}
