from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.application.access_control_service import AccessControlService
from src.application.auth_service import AuthService
from src.domain.file_system_entities import NodeKind
from src.domain.paths import AbsolutePath
from src.presentation.api_schemas import AccessOverrideRequest, AccessOverrideResponse
from src.presentation.auth_dependencies import create_auth_dependencies

logger = logging.getLogger("seneschal.access")


def create_access_control_router(
    auth_service: AuthService,
    access_control_service: AccessControlService,
) -> APIRouter:
    _, _, require_admin = create_auth_dependencies(auth_service)

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
