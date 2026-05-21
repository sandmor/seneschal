from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from src.application.auth_service import AuthService
from src.application.role_management_service import RoleManagementService
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError
from src.presentation.api_schemas import (
    CreateManagedUserRequest,
    ManagedUserResponse,
    RoleRequest,
    RoleResponse,
)


def create_role_router(
    auth_service: AuthService,
    role_management_service: RoleManagementService,
) -> APIRouter:
    router = APIRouter(prefix="/api/admin", tags=["admin"])

    def require_superadmin(authorization: str | None) -> AuthenticatedPrincipal:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization header.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            principal = auth_service.get_current_principal(token)
        except InvalidCredentialsError as error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

        if not principal.is_superadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superadmin access required.",
            )

        return principal

    @router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
    async def create_role(
        request: RoleRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> RoleResponse:
        require_superadmin(authorization)
        role = role_management_service.create_role(request.name, request.description)
        return RoleResponse.from_domain(role)

    @router.get("/roles", response_model=list[RoleResponse])
    async def list_roles(
        authorization: Annotated[str | None, Header()] = None,
    ) -> list[RoleResponse]:
        require_superadmin(authorization)
        return [RoleResponse.from_domain(role) for role in role_management_service.list_roles()]

    @router.patch("/roles/{role_id}", response_model=RoleResponse)
    async def update_role(
        role_id: int,
        request: RoleRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> RoleResponse:
        require_superadmin(authorization)
        role = role_management_service.update_role(role_id, request.name, request.description)
        if role is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

        return RoleResponse.from_domain(role)

    @router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_role(
        role_id: int,
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        require_superadmin(authorization)
        if not role_management_service.delete_role(role_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    @router.post("/users", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
    async def create_user(
        request: CreateManagedUserRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> ManagedUserResponse:
        require_superadmin(authorization)
        user = role_management_service.create_user(request.username, request.password)
        return ManagedUserResponse.from_domain(user)

    @router.get("/users", response_model=list[ManagedUserResponse])
    async def list_users(
        authorization: Annotated[str | None, Header()] = None,
    ) -> list[ManagedUserResponse]:
        require_superadmin(authorization)
        return [
            ManagedUserResponse.from_domain(user)
            for user in role_management_service.list_users()
        ]

    @router.post("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def assign_role(
        user_id: int,
        role_id: int,
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        require_superadmin(authorization)
        if not role_management_service.assign_role_to_user(user_id, role_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or role not found.",
            )

    @router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def revoke_role(
        user_id: int,
        role_id: int,
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        require_superadmin(authorization)
        if not role_management_service.revoke_role_from_user(user_id, role_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User or role not found.",
            )

    @router.patch("/users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
    async def deactivate_user(
        user_id: int,
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        require_superadmin(authorization)
        if not role_management_service.deactivate_user(user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return router
