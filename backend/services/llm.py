from openai import OpenAI, RateLimitError, APIStatusError
from core.config import settings

class LLMService:
    def __init__(self):
        self._client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
        self._models = [m.strip() for m in settings.openrouter_models.split(",") if m.strip()]

    def generate(self, system_prompt: str, user_message: str) -> str:
        last_error = None
        for model in self._models:
            try:
                response = self._client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=0.1,
                )
                return response.choices[0].message.content
            except RateLimitError as e:
                last_error = e
                continue  # kena limit -- coba model berikutnya di daftar
            except APIStatusError as e:
                if e.status_code == 429:
                    last_error = e
                    continue
                raise  # error lain (400, 500, dst) -- jangan ditelan, lempar langsung

        raise RuntimeError(f"Semua model OpenRouter kena limit atau gagal. Error terakhir: {last_error}")

llm_service = LLMService()