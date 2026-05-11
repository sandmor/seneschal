from __future__ import annotations

from typing import Protocol


class TokenStore(Protocol):
    def add(self, token: str) -> None: ...

    def remove(self, token: str) -> None: ...

    def contains(self, token: str) -> bool: ...
