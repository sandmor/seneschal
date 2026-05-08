from __future__ import annotations

from src.domain.auth_entities import User


class UserService:
    def list_users(self) -> list[User]:
        return [
            User(id=1, name="Alice", roles=["admin"]),
            User(id=2, name="Bob", roles=["user"]),
        ]
