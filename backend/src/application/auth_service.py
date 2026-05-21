from __future__ import annotations

from dataclasses import dataclass

from src.application.token_provider_port import TokenProviderPort
from src.domain.auth_entities import AdminProfile
from src.domain.domain_errors import InvalidCredentialsError


@dataclass(slots=True)
class AuthService:
    admin_username: str
    admin_password: str
    token_provider: TokenProviderPort

    def login(self, username: str, password: str) -> str:
        if username != self.admin_username or password != self.admin_password:
            raise InvalidCredentialsError("Invalid credentials.")

        return self.token_provider.generate_access_token(subject=username, role="superadmin")

    def logout(self, token: str) -> None:
        # JWT tokens are stateless — logout is handled client-side by discarding the token.
        # Server-side invalidation would require a token blacklist (future improvement).
        pass

    def verify_token(self, token: str) -> bool:
        return self.token_provider.is_valid(token)

    def get_admin_profile(self) -> AdminProfile:
        return AdminProfile(
            id=1,
            name=self.admin_username,
            role="superadmin",
            roles=["superadmin"],
        )
