from __future__ import annotations

from dataclasses import dataclass

from src.application.password_hasher_port import PasswordHasherPort
from src.application.role_repository import RoleRepository
from src.application.user_repository import UserRepository
from src.domain.role_entities import ManagedUser, Role


@dataclass(slots=True)
class RoleManagementService:
    user_repository: UserRepository
    role_repository: RoleRepository
    password_hasher: PasswordHasherPort

    def create_role(self, name: str, description: str = "") -> Role:
        return self.role_repository.create_role(name, description)

    def list_roles(self) -> list[Role]:
        return self.role_repository.list_roles()

    def update_role(self, role_id: int, name: str, description: str) -> Role | None:
        return self.role_repository.update_role(role_id, name, description)

    def delete_role(self, role_id: int) -> bool:
        return self.role_repository.delete_role(role_id)

    def create_user(self, username: str, password: str) -> ManagedUser:
        password_hash = self.password_hasher.hash_password(password)
        return self.user_repository.create_user(username, password_hash)

    def list_users(self) -> list[ManagedUser]:
        return self.user_repository.list_managed_users()

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        return self.role_repository.assign_role_to_user(user_id, role_id)

    def revoke_role_from_user(self, user_id: int, role_id: int) -> bool:
        return self.role_repository.revoke_role_from_user(user_id, role_id)

    def deactivate_user(self, user_id: int) -> bool:
        return self.user_repository.deactivate_user(user_id)
