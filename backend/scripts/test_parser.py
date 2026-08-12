import os
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import re   
import json
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.parser import DocumentParser
from services.chunker import chunk_document
from services.embedder import embedding_service
from services.vectorstore import vectorstore_service
from services.retriever import retriever_service

from services.vectorstore import vectorstore_service

results = vectorstore_service.similarity_search("doc_7c47457534b59518da1be3f743b3ea5fb42af7256db165885786e0fbd62eff2b", "dimana ibukota gunungkidul", k=5)
for r in results:
    print(f"score={r['score']:.3f} [{r['metadata'].get('pasal')}] {r['text'][:100]}")