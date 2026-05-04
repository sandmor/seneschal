from fastapi import Depends, Header, HTTPException

from src.adapters.storage.in_memory_token_store import InMemoryTokenStore
from src.core.application.auth_service import AuthService
from src.core.application.user_service import UserService
from src.core.ports.token_store import TokenStore

# TODO: Move hardcoded credentials into the real database.
_TOKEN_STORE = InMemoryTokenStore()
_AUTH_SERVICE = AuthService(
    admin_username="admin",
    admin_password="admin123",
    token_store=_TOKEN_STORE,
)
_USER_SERVICE = UserService()


def get_token_store() -> TokenStore:
    return _TOKEN_STORE


def get_auth_service() -> AuthService:
    return _AUTH_SERVICE


def get_user_service() -> UserService:
    return _USER_SERVICE


def require_bearer_token(
    authorization: str | None = Header(default=None),
    token_store: TokenStore = Depends(get_token_store),
) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    if not token_store.contains(token):
        raise HTTPException(status_code=401, detail="Invalid token")

    return token
