from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None

logger = logging.getLogger("seneschal.database")


def _default_db_url() -> str:
    internal_directory = Path(os.getenv("DATABASE_DIRECTORY", ".seneschal")).resolve()
    return f"sqlite:///{internal_directory / 'seneschal.db'}"


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", _default_db_url())


def _resolve_db_path(db_url: str) -> Path | None:
    if db_url.startswith("sqlite:///"):
        raw = db_url.removeprefix("sqlite:///")
        if not raw.startswith(":"):
            return Path(raw).resolve()
    return None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        db_url = get_database_url()
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        _engine = create_engine(db_url, connect_args=connect_args)
        logger.info("Database engine created for %s", db_url)
    return _engine


def _get_session_factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), class_=Session, expire_on_commit=False)
    return _session_factory


class Base(DeclarativeBase):
    pass


def get_session() -> Session:
    return _get_session_factory()()


def init_db() -> None:
    db_url = get_database_url()
    db_path = _resolve_db_path(db_url)
    if db_path is not None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Database initialized at %s", db_path)
    else:
        logger.info("Database initialized (in-memory or non-SQLite)")

    from src.adapters import access_control_repository  # noqa: F401 - registers SQLAlchemy models
    from src.adapters import role_repository  # noqa: F401 - registers SQLAlchemy models

    Base.metadata.create_all(get_engine())
    logger.info("Database tables created/verified")
