from __future__ import annotations

from typing import Protocol

from src.domain.auth_entities import AuthenticatedPrincipal


class TokenProviderPort(Protocol):
    def generate_access_token(
        self,
        *,
        subject: str,
        user_id: int,
        roles: list[str],
        permissions: list[str],
        is_superadmin: bool,
    ) -> str: ...

    def is_valid(self, token: str) -> bool: ...

    def extract_principal(self, token: str) -> AuthenticatedPrincipal: ...
