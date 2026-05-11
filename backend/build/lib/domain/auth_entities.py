from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class User:
    id: int
    name: str
    roles: list[str]


@dataclass(frozen=True, slots=True)
class AdminProfile:
    id: int
    name: str
    role: str
    roles: list[str]
