from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import Column, Integer, String, UniqueConstraint, JSON, select
from sqlalchemy.orm import Session

from src.adapters.database import Base, get_session
from src.application.access_control_repository import AccessControlRepository
from src.domain.access_control import AccessLevel, AccessOverride
from src.domain.file_system_entities import NodeKind
from src.domain.paths import AbsolutePath


class AccessControlModel(Base):
    __tablename__ = "access_controls"
    __table_args__ = (UniqueConstraint("path", "kind", name="uq_access_controls_path_kind"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    path = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    default_access = Column(String, nullable=True)
    role_overrides = Column(JSON, default=dict, nullable=False)


class SqlAlchemyAccessControlRepository(AccessControlRepository):
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_override(self, path: AbsolutePath, kind: NodeKind) -> AccessOverride | None:
        with self._session_factory() as session:
            statement = select(AccessControlModel).where(
                AccessControlModel.path == path.value,
                AccessControlModel.kind == kind.value,
            )
            model = session.scalars(statement).one_or_none()
            return _to_override(model) if model else None

    def list_overrides(self) -> list[AccessOverride]:
        with self._session_factory() as session:
            models = session.scalars(
                select(AccessControlModel).order_by(AccessControlModel.path)
            ).all()
            return [_to_override(model) for model in models]

    def list_overrides_for_paths(
        self, paths: list[AbsolutePath], kind: NodeKind | None = None
    ) -> list[AccessOverride]:
        if not paths:
            return []
        path_values = [path.value for path in paths]
        with self._session_factory() as session:
            statement = select(AccessControlModel).where(AccessControlModel.path.in_(path_values))
            if kind is not None:
                statement = statement.where(AccessControlModel.kind == kind.value)
            models = session.scalars(statement).all()
            return [_to_override(model) for model in models]

    def upsert_override(
        self,
        *,
        path: AbsolutePath,
        kind: NodeKind,
        default_access: AccessLevel | None,
        role_overrides: dict[str, AccessLevel],
    ) -> AccessOverride:
        with self._session_factory() as session:
            statement = select(AccessControlModel).where(
                AccessControlModel.path == path.value,
                AccessControlModel.kind == kind.value,
            )
            model = session.scalars(statement).one_or_none()
            if model is None:
                model = AccessControlModel(path=path.value, kind=kind.value)
                session.add(model)

            model.default_access = default_access.value if default_access is not None else None
            model.role_overrides = {
                role: access.value for role, access in sorted(role_overrides.items())
            }
            session.commit()
            session.refresh(model)
            return _to_override(model)

    def delete_override(self, path: AbsolutePath, kind: NodeKind) -> bool:
        with self._session_factory() as session:
            statement = select(AccessControlModel).where(
                AccessControlModel.path == path.value,
                AccessControlModel.kind == kind.value,
            )
            model = session.scalars(statement).one_or_none()
            if model is None:
                return False

            session.delete(model)
            session.commit()
            return True


def _parse_access_level(value: str | None) -> AccessLevel | None:
    if value is None:
        return None
    try:
        return AccessLevel(value)
    except ValueError:
        return None


def _parse_role_overrides(raw: object) -> dict[str, AccessLevel]:
    if not isinstance(raw, dict):
        return {}

    parsed: dict[str, AccessLevel] = {}
    for role, level in raw.items():
        try:
            parsed[str(role)] = AccessLevel(str(level))
        except ValueError:
            continue
    return parsed


def _to_override(model: AccessControlModel) -> AccessOverride:
    return AccessOverride(
        path=AbsolutePath.parse(model.path),
        kind=NodeKind(model.kind),
        default_access=_parse_access_level(model.default_access),
        role_overrides=_parse_role_overrides(model.role_overrides),
    )


def create_access_control_repository() -> AccessControlRepository:
    return SqlAlchemyAccessControlRepository(get_session)
