from __future__ import annotations

from typing import Protocol

from src.domain.access_control import AccessLevel, AccessOverride
from src.domain.file_system_entities import NodeKind
from src.domain.paths import AbsolutePath


class AccessControlRepository(Protocol):
    def get_override(self, path: AbsolutePath, kind: NodeKind) -> AccessOverride | None: ...

    def list_overrides(self) -> list[AccessOverride]: ...

    def list_overrides_for_paths(
        self, paths: list[AbsolutePath], kind: NodeKind | None = None
    ) -> list[AccessOverride]: ...

    def upsert_override(
        self,
        *,
        path: AbsolutePath,
        kind: NodeKind,
        default_access: AccessLevel | None,
        role_overrides: dict[str, AccessLevel],
    ) -> AccessOverride: ...

    def delete_override(self, path: AbsolutePath, kind: NodeKind) -> bool: ...
