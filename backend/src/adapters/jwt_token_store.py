from __future__ import annotations

from src.application.auth_service import AuthService
from src.domain.domain_errors import InvalidCredentialsError


class JwtTokenStore:
    """
    Stateless token store that validates JWT tokens using AuthService.
    Replaces InMemoryTokenStore — no server-side state needed.
    """

    def __init__(self, auth_service: AuthService) -> None:
        self._auth_service = auth_service

    def add(self, token: str) -> None:
        # JWT tokens are self-contained — nothing to store server-side.
        pass

    def remove(self, token: str) -> None:
        # Logout is handled client-side by discarding the token.
        pass

    def contains(self, token: str) -> bool:
        try:
            self._auth_service.verify_token(token)
            return True
        except InvalidCredentialsError:
            return False
