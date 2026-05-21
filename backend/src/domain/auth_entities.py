from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class User:
    id: int
    name: str
    roles: list[str]


@dataclass(frozen=True, slots=True)
class UserAccount:
    id: int
    username: str
    password_hash: str
    is_active: bool
    roles: list[str]


@dataclass(frozen=True, slots=True)
class AuthenticatedPrincipal:
    id: int
    username: str
    role: str
    roles: list[str]
    is_superadmin: bool

    @property
    def name(self) -> str:
        return self.username
