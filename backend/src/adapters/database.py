
from __future__ import annotations
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./data/seneschal.db")


def _resolve_db_path() -> Path | None:
    """Extrae la ruta del archivo si es SQLite local."""
    if DB_URL.startswith("sqlite:///"):
        raw = DB_URL.removeprefix("sqlite:///")
        if not raw.startswith(":"):  
            return Path(raw).resolve()
    return None


engine = create_engine(DB_URL, connect_args={"check_same_thread": False})


class Base(DeclarativeBase):
    pass


def get_session() -> Session:
    return Session(engine)


def init_db() -> None:
    db_path = _resolve_db_path()
    if db_path is not None:
        db_path.parent.mkdir(parents=True, exist_ok=True)  # crea data/ si no existe

    from src.adapters import role_repository  # noqa: F401 - registra los modelos
    Base.metadata.create_all(engine)