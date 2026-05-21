from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from src.domain.domain_errors import InvalidCredentialsError

# TODO: Implement full JWT workflow with refresh tokens.
# Access tokens should ideally expire in ~10 minutes once refresh tokens
# are supported. Currently set to 10 minutes as recommended.
ACCESS_TOKEN_EXPIRE_MINUTES = 10
ALGORITHM = "HS256"


class JwtTokenAdapter:
    """
    Adapter that implements TokenProviderPort using PyJWT.
    Stateless — no server-side token storage needed.
    """

    def __init__(self, secret_key: str) -> None:
        self._secret_key = secret_key

    def generate_access_token(self, subject: str, role: str) -> str:
        payload = {
            "sub": subject,
            "role": role,
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

    def extract_subject(self, token: str) -> str:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[ALGORITHM])
            return str(payload["sub"])
        except jwt.InvalidTokenError as e:
            raise InvalidCredentialsError("Invalid token.") from e

    # TokenStore protocol compatibility (used by api_router to validate requests)
    def add(self, token: str) -> None:
        pass  # Stateless — nothing to store

    def remove(self, token: str) -> None:
        pass  # Stateless — nothing to remove

    def contains(self, token: str) -> bool:
        return self.is_valid(token)
