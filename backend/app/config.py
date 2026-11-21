import os


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://speak:speak@postgres:5432/speak"
    )
    # AI: any OpenAI-compatible /chat/completions endpoint. Key stays on the server.
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    # MinIO object storage for recorded audio.
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    minio_bucket: str = os.getenv("MINIO_BUCKET", "speak-audio")


settings = Settings()
