from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from src.application.auth_service import AuthService
from src.application.role_management_service import RoleManagementService
from src.presentation.api_schemas import (
    CreateManagedUserRequest,
    ManagedUserResponse,
    RoleRequest,
    RoleResponse,
)
from src.presentation.auth_dependencies import create_auth_dependencies

logger = logging.getLogger("seneschal.admin")


def create_role_router(
    auth_service: AuthService,
    role_management_service: RoleManagementService,
) -> APIRouter:
    _, _, require_admin = create_auth_dependencies(auth_service)

    router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

    @router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
    async def create_role(request: RoleRequest) -> RoleResponse:
        logger.info("Create role: %s", request.name)
        role = role_management_service.create_role(
            request.name, request.description, request.permissions
        )
        logger.info("Role created: %s (id=%s)", role.name, role.id)
        return RoleResponse.from_domain(role)

    @router.get("/roles", response_model=list[RoleResponse])
    async def list_roles() -> list[RoleResponse]:
        roles = role_management_service.list_roles()
        logger.debug("Listed %d roles", len(roles))
        return [RoleResponse.from_domain(role) for role in roles]

    @router.patch("/roles/{role_id}", response_model=RoleResponse)
    async def update_role(role_id: int, request: RoleRequest) -> RoleResponse:
        logger.info("Update role id=%s", role_id)
        role = role_management_service.update_role(
            role_id, request.name, request.description, request.permissions
        )
        if role is None:
            logger.warning("Role not found for update: id=%s", role_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

        logger.info("Role updated: %s (id=%s)", role.name, role.id)
        return RoleResponse.from_domain(role)

    @router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_role(role_id: int) -> None:
        logger.info("Delete role id=%s", role_id)
        if not role_management_service.delete_role(role_id):
            logger.warning("Role not found for deletion: id=%s", role_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")
        logger.info("Role deleted: id=%s", role_id)

    @router.post("/users", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
    async def create_user(request: CreateManagedUserRequest) -> ManagedUserResponse:
        logger.info("Create user: %s", request.username)
        user = role_management_service.create_user(request.username, request.password)
        logger.info("User created: %s (id=%s)", user.username, user.id)
        return ManagedUserResponse.from_domain(user)

    @router.get("/users", response_model=list[ManagedUserResponse])
    async def list_users() -> list[ManagedUserResponse]:
        users = role_management_service.list_users()
        logger.debug("Listed %d managed users", len(users))
        return [ManagedUserResponse.from_domain(user) for user in users]

    @router.post("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def assign_role(user_id: int, role_id: int) -> None:
        logger.info("Assign role %s to user %s", role_id, user_id)
        if not role_management_service.assign_role_to_user(user_id, role_id):
            logger.warning("Failed to assign role %s to user %s", role_id, user_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or role not found.",
            )
        logger.info("Role %s assigned to user %s", role_id, user_id)

    @router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def revoke_role(user_id: int, role_id: int) -> None:
        logger.info("Revoke role %s from user %s", role_id, user_id)
        if not role_management_service.revoke_role_from_user(user_id, role_id):
            logger.warning("Failed to revoke role %s from user %s", role_id, user_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or role not found.",
            )
        logger.info("Role %s revoked from user %s", role_id, user_id)

    @router.patch("/users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
    async def deactivate_user(user_id: int) -> None:
        logger.info("Deactivate user %s", user_id)
        if not role_management_service.deactivate_user(user_id):
            logger.warning("User not found for deactivation: id=%s", user_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        logger.info("User %s deactivated", user_id)

    return router
