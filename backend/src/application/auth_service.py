from __future__ import annotations

import logging
from dataclasses import dataclass

from src.application.password_hasher_port import PasswordHasherPort
from src.application.token_provider_port import TokenProviderPort
from src.application.user_repository import UserRepository
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError

logger = logging.getLogger("seneschal.auth")


@dataclass(slots=True)
class AuthService:
    admin_username: str
    admin_password: str
    token_provider: TokenProviderPort
    user_repository: UserRepository
    password_hasher: PasswordHasherPort

    def login(self, username: str, password: str) -> str:
        if username == self.admin_username and password == self.admin_password:
            logger.info("Admin login successful: %s", username)
            return self.token_provider.generate_access_token(
                subject=username,
                user_id=0,
                roles=["superadmin"],
                permissions=["admin"],
                is_superadmin=True,
            )

        account = self.user_repository.get_by_username(username)
        if account is None or not account.is_active:
            logger.warning("Login failed for user %s: invalid credentials or inactive", username)
            raise InvalidCredentialsError("Invalid credentials.")

        if not self.password_hasher.verify_password(password, account.password_hash):
            logger.warning("Login failed for user %s: password mismatch", username)
            raise InvalidCredentialsError("Invalid credentials.")

        logger.info("User login successful: %s (id=%s)", username, account.id)
        return self.token_provider.generate_access_token(
            subject=account.username,
            user_id=account.id,
            roles=account.roles,
            permissions=account.permissions,
            is_superadmin=False,
        )

    def logout(self, token: str) -> None:
        # JWT tokens are stateless — logout is handled client-side by discarding the token.
        # Server-side invalidation would require a token blacklist (future improvement).
        logger.debug("Logout called (stateless token)")

    def verify_token(self, token: str) -> bool:
        return self.token_provider.is_valid(token)

    def get_current_principal(self, token: str) -> AuthenticatedPrincipal:
        try:
            principal = self.token_provider.extract_principal(token)
        except InvalidCredentialsError:
            logger.warning("Token validation failed")
            raise
        logger.debug("Token validated for user %s", principal.username)
        return principal
