import secrets

from src.core.domain.errors import InvalidCredentialsError
from src.core.domain.models import AdminProfile
from src.core.ports.token_store import TokenStore


class AuthService:
    def __init__(self, admin_username: str, admin_password: str, token_store: TokenStore) -> None:
        self._admin_username = admin_username
        self._admin_password = admin_password
        self._token_store = token_store

    def login(self, username: str, password: str) -> str:
        if username != self._admin_username or password != self._admin_password:
            raise InvalidCredentialsError("Invalid credentials")

        token = secrets.token_urlsafe(32)
        self._token_store.add(token)
        return token

    def logout(self, token: str) -> None:
        self._token_store.remove(token)

    # This is temporal before the DB
    def get_admin_profile(self) -> AdminProfile:
        return AdminProfile(
            id=1,
            name=self._admin_username,
            role="superadmin",
            roles=["superadmin"],
        )
