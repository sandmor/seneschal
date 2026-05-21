from __future__ import annotations

from typing import Protocol


class TokenProviderPort(Protocol):
    """
    Port for JWT token operations.
    Adapters implementing this port handle token generation and validation.

    TODO: Implement refresh token workflow:
      - generate_refresh_token(user_id: str) -> str
      - refresh_access_token(refresh_token: str) -> str
    This is needed for a full JWT workflow where access tokens have short
    expiry (~10 min) and refresh tokens have longer expiry (~7 days).
    """

    def generate_access_token(self, subject: str, role: str) -> str:
        """Generate a signed JWT access token for the given subject."""
        ...

    def is_valid(self, token: str) -> bool:
        """Return True if the token signature and expiry are valid."""
        ...

    def extract_subject(self, token: str) -> str:
        """Extract the subject (e.g. username) from a valid token."""
        ...
