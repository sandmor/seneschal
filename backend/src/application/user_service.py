from __future__ import annotations

from dataclasses import dataclass

from src.application.user_repository import UserRepository
from src.domain.auth_entities import User


@dataclass(slots=True)
class UserService:
    user_repository: UserRepository

    def list_users(self) -> list[User]:
        return self.user_repository.list_users()
