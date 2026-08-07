from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"

    class Config:
        env_file = ".env"

class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    jdih_api_secret: str

    class Config:
        env_file = ".env"
        
settings = Settings()