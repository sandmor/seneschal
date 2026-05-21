from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError

ACCESS_TOKEN_EXPIRE_MINUTES = 10
ALGORITHM = "HS256"


class JwtTokenAdapter:
    def __init__(self, secret_key: str) -> None:
        self._secret_key = secret_key

    def generate_access_token(
        self,
        *,
        subject: str,
        user_id: int,
        roles: list[str],
        permissions: list[str],
        is_superadmin: bool,
    ) -> str:
        normalized_roles = list(dict.fromkeys(roles))
        normalized_permissions = list(dict.fromkeys(permissions))
        payload = {
            "sub": subject,
            "user_id": user_id,
            "role": normalized_roles[0] if normalized_roles else "",
            "roles": normalized_roles,
            "permissions": normalized_permissions,
            "is_superadmin": is_superadmin,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, self._secret_key, algorithm=ALGORITHM)

    def is_valid(self, token: str) -> bool:
        try:
            jwt.decode(token, self._secret_key, algorithms=[ALGORITHM])
            return True
        except jwt.InvalidTokenError:
            return False

    def extract_principal(self, token: str) -> AuthenticatedPrincipal:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError as error:
            raise InvalidCredentialsError("Invalid token.") from error

        roles = payload.get("roles")
        if not isinstance(roles, list):
            role = str(payload.get("role", ""))
            roles = [role] if role else []

        permissions = payload.get("permissions")
        if not isinstance(permissions, list):
            permissions = []

        normalized_roles = [str(role) for role in roles]
        normalized_permissions = [str(perm) for perm in permissions]
        return AuthenticatedPrincipal(
            id=int(payload["user_id"]),
            username=str(payload["sub"]),
            role=normalized_roles[0] if normalized_roles else "",
            roles=normalized_roles,
            permissions=normalized_permissions,
            is_superadmin=bool(payload.get("is_superadmin", False)),
        )
