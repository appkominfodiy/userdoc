import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI


load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
BASE_URL = "https://openrouter.ai/api/v1"

# Model 1: OpenRouter Auto-Route Free
llm1 = ChatOpenAI(
    model="openrouter/free",
    api_key=API_KEY,
    base_url=BASE_URL,
    temperature=0.7
)

# Model 2: Google Gemma 4 26B IT (Free)
llm2 = ChatOpenAI(
    model="google/gemma-4-26b-a4b-it:free",
    api_key=API_KEY,
    base_url=BASE_URL,
    temperature=0.7
)

# Model 3: NVIDIA Nemotron 3 Nano (Free)
llm3 = ChatOpenAI(
    model="nvidia/nemotron-3-nano-30b-a3b:free",
    api_key=API_KEY,
    base_url=BASE_URL,
    temperature=0.7
)

# Model 4: Poolside Laguna XS (Free)
llm4 = ChatOpenAI(
    model="poolside/laguna-xs-2.1:free",
    api_key=API_KEY,
    base_url=BASE_URL,
    temperature=0.7
)

# Model 5: OpenAI GPT-OSS (Free)
llm5 = ChatOpenAI(
    model="openai/gpt-oss-20b:free",
    api_key=API_KEY,
    base_url=BASE_URL,
    temperature=0.7
)

# Daftar model untuk manual fallback agar kebal terhadap error 404 (model ditarik dari free tier)
models = [llm1, llm2, llm3, llm4, llm5]

def generate_response(query: str, context: list[dict]) -> str:
    """
    Menghasilkan jawaban dari LLM berdasarkan konteks RAG.
    """
    # Menggabungkan teks dari chunk yang relevan
    context_text = "\n\n".join([
        f"Sumber: {c['filename']} (Halaman {c['page_number']})\n{c['text']}" 
        for c in context
    ])
    
    prompt = f"""Anda adalah asisten virtual hukum (JDIH) yang membantu menjawab pertanyaan berdasarkan dokumen peraturan yang diberikan.
Jika konteks memiliki informasi yang relevan, jawablah pertanyaan HANYA berdasarkan konteks tersebut.
Namun, jika konteks kosong atau tidak memiliki informasi yang cukup, cobalah jawab sebaik mungkin berdasarkan pengetahuan umum Anda mengenai dokumen atau topik yang ditanyakan, tetapi Anda HARUS menambahkan catatan di akhir bahwa jawaban ini bersifat umum karena dokumen aslinya belum diproses ke dalam database.

Konteks:
{context_text}

Pertanyaan:
{query}

Jawaban (berikan jawaban informatif dalam bahasa Indonesia):"""

    last_error = None
    for llm in models:
        try:
            response = llm.invoke(prompt)
            return response.content
        except Exception as e:
            last_error = e
            continue  # Langsung coba model berikutnya jika error (misal 404 atau rate limit)
            
    # Jika semua 5 model gagal
    return f"Mohon maaf, semua 5 model AI saat ini sedang tidak tersedia atau penuh: {str(last_error)}"
