from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import jwt

from src.domain.auth_entities import AdminProfile
from src.domain.domain_errors import InvalidCredentialsError

# Token expiry: 8 hours
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8
ALGORITHM = "HS256"


@dataclass(slots=True)
class AuthService:
    admin_username: str
    admin_password: str
    secret_key: str = field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", "changeme"))

    def login(self, username: str, password: str) -> str:
        if username != self.admin_username or password != self.admin_password:
            raise InvalidCredentialsError("Invalid credentials.")

        payload = {
            "sub": username,
            "role": "superadmin",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.now(timezone.utc),
        }

        return jwt.encode(payload, self.secret_key, algorithm=ALGORITHM)

    def logout(self, token: str) -> None:
        # With JWT, logout is handled client-side by discarding the token.
        # For server-side invalidation a token blacklist would be needed.
        pass

    def verify_token(self, token: str) -> dict:
        try:
            return jwt.decode(token, self.secret_key, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError as e:
            raise InvalidCredentialsError("Token has expired.") from e
        except jwt.InvalidTokenError as e:
            raise InvalidCredentialsError("Invalid token.") from e

    def get_admin_profile(self) -> AdminProfile:
        return AdminProfile(
            id=1,
            name=self.admin_username,
            role="superadmin",
            roles=["superadmin"],
        )
