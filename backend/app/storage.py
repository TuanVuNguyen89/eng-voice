import io
from functools import lru_cache

from minio import Minio

from .config import settings


@lru_cache(maxsize=1)
def client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def ensure_bucket(retries: int = 30, delay: float = 2.0) -> None:
    import time

    for attempt in range(1, retries + 1):
        try:
            c = client()
            if not c.bucket_exists(settings.minio_bucket):
                c.make_bucket(settings.minio_bucket)
            return
        except Exception as exc:  # noqa: BLE001
            if attempt == retries:
                raise
            print(f"[minio] waiting for MinIO ({attempt}/{retries}): {exc}", flush=True)
            time.sleep(delay)


def put_audio(key: str, data: bytes, content_type: str) -> None:
    client().put_object(
        settings.minio_bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )


def get_audio(key: str):
    """Return the MinIO response; caller must close() and release_conn() it."""
    return client().get_object(settings.minio_bucket, key)
