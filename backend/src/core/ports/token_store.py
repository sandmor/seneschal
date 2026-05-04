from typing import Protocol


# TODO: Replace this with a DB-backed implementation.
class TokenStore(Protocol):
    def add(self, token: str) -> None:
        pass

    def remove(self, token: str) -> None:
        pass

    def contains(self, token: str) -> bool:
        pass
