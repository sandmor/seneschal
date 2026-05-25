from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from src.application.access_control_service import AccessControlService
from src.application.auth_service import AuthService
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError
from src.domain.file_system_entities import NodeKind
from src.domain.paths import AbsolutePath
from src.presentation.api_schemas import AccessOverrideRequest, AccessOverrideResponse

logger = logging.getLogger("seneschal.access")


def create_access_control_router(
    auth_service: AuthService,
    access_control_service: AccessControlService,
) -> APIRouter:
    def get_token(authorization: Annotated[str | None, Header()] = None) -> str:
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
        return token

    def require_admin(token: str = Depends(get_token)) -> AuthenticatedPrincipal:
        try:
            principal = auth_service.get_current_principal(token)
        except InvalidCredentialsError as error:
            logger.warning("Access control admin access denied: invalid token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

        if not principal.is_superadmin and "admin" not in principal.permissions:
            logger.warning("Access control admin access denied for user %s", principal.username)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin or Superadmin access required.",
            )

        return principal

    router = APIRouter(
        prefix="/api/admin/access-control",
        tags=["access-control"],
        dependencies=[Depends(require_admin)],
    )

    @router.get("", response_model=list[AccessOverrideResponse])
    async def list_overrides() -> list[AccessOverrideResponse]:
        overrides = access_control_service.list_overrides()
        return [AccessOverrideResponse.from_domain(override) for override in overrides]

    @router.put("", response_model=AccessOverrideResponse)
    async def upsert_override(request: AccessOverrideRequest) -> AccessOverrideResponse:
        override_path = _parse_override_path(request.path, request.kind)
        override = access_control_service.set_override(
            path=override_path,
            kind=request.kind,
            default_access=request.default_access,
            role_overrides=request.role_overrides,
        )
        return AccessOverrideResponse.from_domain(override)

    @router.delete("", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_override(
        path: str = Query(...),
        kind: NodeKind = Query(...),
    ) -> None:
        override_path = _parse_override_path(path, kind)
        if not access_control_service.delete_override(path=override_path, kind=kind):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override not found.")

    return router


def _parse_override_path(raw_path: str, kind: NodeKind) -> AbsolutePath:
    path = AbsolutePath.parse(raw_path)
    if kind == NodeKind.DIRECTORY:
        return path.ensure_directory()
    return path.ensure_document()
