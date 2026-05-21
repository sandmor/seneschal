from __future__ import annotations

from typing import Protocol


class PasswordHasherPort(Protocol):
    def hash_password(self, password: str) -> str: ...

    def verify_password(self, password: str, password_hash: str) -> bool: ...
