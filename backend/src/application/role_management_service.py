from __future__ import annotations

import logging
from dataclasses import dataclass

from src.application.password_hasher_port import PasswordHasherPort
from src.application.role_repository import RoleRepository
from src.application.user_repository import UserRepository
from src.domain.role_entities import ManagedUser, Role

logger = logging.getLogger("seneschal.roles")


@dataclass(slots=True)
class RoleManagementService:
    user_repository: UserRepository
    role_repository: RoleRepository
    password_hasher: PasswordHasherPort

    def create_role(
        self, name: str, description: str = "", permissions: list[str] | None = None
    ) -> Role:
        logger.info("Creating role: %s", name)
        role = self.role_repository.create_role(name, description, permissions)
        logger.info("Role created: %s (id=%s)", role.name, role.id)
        return role

    def list_roles(self) -> list[Role]:
        roles = self.role_repository.list_roles()
        logger.debug("Listed %d roles", len(roles))
        return roles

    def update_role(
        self, role_id: int, name: str, description: str, permissions: list[str] | None = None
    ) -> Role | None:
        logger.info("Updating role id=%s", role_id)
        role = self.role_repository.update_role(role_id, name, description, permissions)
        if role is not None:
            logger.info("Role updated: %s (id=%s)", role.name, role.id)
        else:
            logger.warning("Role not found for update: id=%s", role_id)
        return role

    def delete_role(self, role_id: int) -> bool:
        logger.info("Deleting role id=%s", role_id)
        result = self.role_repository.delete_role(role_id)
        if result:
            logger.info("Role deleted: id=%s", role_id)
        else:
            logger.warning("Role not found for deletion: id=%s", role_id)
        return result

    def create_user(self, username: str, password: str) -> ManagedUser:
        logger.info("Creating user: %s", username)
        password_hash = self.password_hasher.hash_password(password)
        user = self.user_repository.create_user(username, password_hash)
        logger.info("User created: %s (id=%s)", user.username, user.id)
        return user

    def list_users(self) -> list[ManagedUser]:
        users = self.user_repository.list_managed_users()
        logger.debug("Listed %d managed users", len(users))
        return users

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        logger.info("Assigning role %s to user %s", role_id, user_id)
        result = self.role_repository.assign_role_to_user(user_id, role_id)
        if result:
            logger.info("Role %s assigned to user %s", role_id, user_id)
        else:
            logger.warning("Failed to assign role %s to user %s", role_id, user_id)
        return result

    def revoke_role_from_user(self, user_id: int, role_id: int) -> bool:
        logger.info("Revoking role %s from user %s", role_id, user_id)
        result = self.role_repository.revoke_role_from_user(user_id, role_id)
        if result:
            logger.info("Role %s revoked from user %s", role_id, user_id)
        else:
            logger.warning("Failed to revoke role %s from user %s", role_id, user_id)
        return result

    def deactivate_user(self, user_id: int) -> bool:
        logger.info("Deactivating user %s", user_id)
        result = self.user_repository.deactivate_user(user_id)
        if result:
            logger.info("User %s deactivated", user_id)
        else:
            logger.warning("User not found for deactivation: id=%s", user_id)
        return result
