
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Role:
    name: str
    description: str = ""
    id: int | None = field(default=None)


@dataclass
class User:
    username: str
    email: str
    is_active: bool = True
    id: int | None = field(default=None)
    roles: list[Role] = field(default_factory=list)