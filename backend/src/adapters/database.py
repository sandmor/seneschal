from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./data/seneschal.db")
engine = create_engine(DB_PATH, connect_args={"check_same_thread": False})


class Base(DeclarativeBase):
    pass


def get_session() -> Session:
    return Session(engine)


def init_db() -> None:
    from src.adapters import role_repository  # noqa: F401 - registra los modelos

    Base.metadata.create_all(engine)
