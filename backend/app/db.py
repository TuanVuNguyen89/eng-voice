import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 30, delay: float = 2.0) -> None:
    """Create tables once PostgreSQL accepts connections (compose starts it in parallel)."""
    from . import models  # noqa: F401  (registers the models on Base)

    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            Base.metadata.create_all(engine)
            # Migration for databases created before accounts existed.
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "
                        "user_id uuid REFERENCES users(id) ON DELETE CASCADE"
                    )
                )
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions (user_id)"))
            return
        except Exception as exc:  # noqa: BLE001
            if attempt == retries:
                raise
            print(f"[db] waiting for PostgreSQL ({attempt}/{retries}): {exc}", flush=True)
            time.sleep(delay)
