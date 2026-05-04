from src.core.ports.token_store import TokenStore


class InMemoryTokenStore(TokenStore):
    def __init__(self) -> None:
        self._tokens: set[str] = set()

    def add(self, token: str) -> None:
        self._tokens.add(token)

    def remove(self, token: str) -> None:
        self._tokens.discard(token)

    def contains(self, token: str) -> bool:
        return token in self._tokens
