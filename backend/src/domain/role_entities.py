from __future__ import annotations
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Role:
    name: str
    description: str = ""
    id: int | None = field(default=None)


@dataclass(frozen=True, slots=True)
class ManagedUser:
    username: str
    is_active: bool = True
    id: int | None = field(default=None)
    roles: list[Role] = field(default_factory=list)
