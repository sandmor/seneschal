from __future__ import annotations

import secrets
from dataclasses import dataclass

from src.application.token_store import TokenStore
from src.domain.auth_entities import AdminProfile
from src.domain.domain_errors import InvalidCredentialsError


@dataclass(slots=True)
class AuthService:
    admin_username: str
    admin_password: str
    token_store: TokenStore

    def login(self, username: str, password: str) -> str:
        if username != self.admin_username or password != self.admin_password:
            raise InvalidCredentialsError("Invalid credentials.")

        token = secrets.token_urlsafe(32)
        self.token_store.add(token)
        return token

    def logout(self, token: str) -> None:
        self.token_store.remove(token)

    def get_admin_profile(self) -> AdminProfile:
        return AdminProfile(
            id=1,
            name=self.admin_username,
            role="superadmin",
            roles=["superadmin"],
        )
