from __future__ import annotations

import logging
from dataclasses import dataclass

from src.application.user_repository import UserRepository
from src.domain.auth_entities import User

logger = logging.getLogger("seneschal.users")


@dataclass(slots=True)
class UserService:
    user_repository: UserRepository

    def list_users(self) -> list[User]:
        users = self.user_repository.list_users()
        logger.debug("Listed %d users", len(users))
        return users
