import os
import tempfile
import requests
import numpy as np
from app.services.pdf_processor import extract_text_from_pdf
from app.services.chunker import chunk_pages
from app.services.vector_store import embedding_model

# Cache dictionary to store processed PDF embeddings to speed up chat
_pdf_cache = {}

def process_pdf_on_the_fly(pdf_url: str, query: str, top_k: int = 3) -> list[dict]:
    """
    Mengunduh PDF secara langsung dari URL, mengekstrak, memecah (chunking),
    dan mencari bagian teks yang relevan dengan pertanyaan tanpa menyimpannya
    ke ChromaDB.
    """
    try:
        # Check cache first
        if pdf_url in _pdf_cache:
            chunks = _pdf_cache[pdf_url]["chunks"]
            chunk_embeddings = _pdf_cache[pdf_url]["embeddings"]
        else:
            # Download file sementara
            response = requests.get(pdf_url, stream=True, timeout=15)
            response.raise_for_status()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp_file.write(chunk)
                temp_path = tmp_file.name
                
            try:
                # Ekstrak teks
                pages = extract_text_from_pdf(temp_path)
                
                # Buat chunks
                chunks = chunk_pages(pages)
                if not chunks:
                    return []
                    
                # Ambil teks dari semua chunk
                texts = [c['text'] for c in chunks]
                
                # Embeddings
                chunk_embeddings = embedding_model.encode(texts)
                
                # Save to cache
                _pdf_cache[pdf_url] = {
                    "chunks": chunks,
                    "embeddings": chunk_embeddings
                }
            finally:
                # Hapus file sementara
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        # Proses query
        query_embedding = embedding_model.encode([query])
            
        # Cosine similarity menggunakan Numpy murni
        norm_query = np.linalg.norm(query_embedding, axis=1, keepdims=True)
        norm_chunks = np.linalg.norm(chunk_embeddings, axis=1, keepdims=True)
        
        q_norm = query_embedding / (norm_query + 1e-10)
        c_norm = chunk_embeddings / (norm_chunks + 1e-10)
        
        # Hitung skor kemiripan
        scores = np.dot(q_norm, c_norm.T)[0]
        
        # Ambil Top K indeks
        top_indices = np.argsort(scores)[-top_k:][::-1]
        
        results = []
        filename = pdf_url.split("/")[-1]
        if "?" in filename:
            filename = filename.split("?")[0]
        
        for idx in top_indices:
            score = float(scores[idx])
            chunk = chunks[idx]
            results.append({
                "text": chunk["text"],
                "filename": filename,
                "page_number": chunk["page_number"],
                "similarity_score": score
            })
            
        return results
    except Exception as e:
        print(f"Error on-the-fly PDF reading: {str(e)}")
        return []
