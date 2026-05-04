from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    name: str
    roles: list[str]


@dataclass(frozen=True)
class AdminProfile:
    id: int
    name: str
    role: str
    roles: list[str]
