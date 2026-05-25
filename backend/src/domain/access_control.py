from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from src.domain.file_system_entities import NodeKind
from src.domain.paths import AbsolutePath


class AccessLevel(StrEnum):
    NONE = "none"
    READ = "read"
    WRITE = "write"


_ACCESS_RANK = {
    AccessLevel.NONE: 0,
    AccessLevel.READ: 1,
    AccessLevel.WRITE: 2,
}


def max_access(levels: list[AccessLevel]) -> AccessLevel:
    if not levels:
        return AccessLevel.NONE
    return max(levels, key=_ACCESS_RANK.__getitem__)


def is_access_at_least(level: AccessLevel, required: AccessLevel) -> bool:
    return _ACCESS_RANK[level] >= _ACCESS_RANK[required]


@dataclass(frozen=True, slots=True)
class AccessOverride:
    path: AbsolutePath
    kind: NodeKind
    default_access: AccessLevel | None
    role_overrides: dict[str, AccessLevel]


@dataclass(frozen=True, slots=True)
class EffectiveAccessPolicy:
    default_access: AccessLevel
    role_overrides: dict[str, AccessLevel]

    def apply_override(self, override: AccessOverride | None) -> "EffectiveAccessPolicy":
        if override is None:
            return self

        default_access = (
            override.default_access if override.default_access is not None else self.default_access
        )
        role_overrides = {**self.role_overrides, **override.role_overrides}
        return EffectiveAccessPolicy(default_access=default_access, role_overrides=role_overrides)

    def access_for_roles(self, roles: list[str]) -> AccessLevel:
        if not roles:
            return self.default_access

        levels = [self.role_overrides.get(role, self.default_access) for role in roles]
        return max_access(levels)
