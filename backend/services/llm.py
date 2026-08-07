from groq import Groq
from core.config import settings

    # multi connection llm untuk kebutuhan ketika llmnya habis bisa switching otomatis, 
    # rekomendasi menggunakan hermes agent
class LLMService:
    def __init__(self):
        self._client = Groq(api_key=settings.groq_api_key)
        self._model = settings.groq_model

    def generate(self, system_prompt: str, user_message: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
        )
        return response.choices[0].message.content

llm_service = LLMService()