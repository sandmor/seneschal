from __future__ import annotations

from typing import Protocol

from src.domain.auth_entities import User, UserAccount
from src.domain.role_entities import ManagedUser


class UserRepository(Protocol):
    def get_by_username(self, username: str) -> UserAccount | None: ...

    def list_users(self) -> list[User]: ...

    def list_managed_users(self) -> list[ManagedUser]: ...

    def create_user(self, username: str, password_hash: str) -> ManagedUser: ...

    def deactivate_user(self, user_id: int) -> bool: ...
