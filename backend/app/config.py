from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "sqlite:///./meridian.db"
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "*"
    sync_batch_size: int = 100

    class Config:
        env_file = ".env"


settings = Settings()
