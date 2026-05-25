from __future__ import annotations

from src.domain.auth_entities import AuthenticatedPrincipal

ADMIN_PERMISSION = "admin"
FILES_READ_PERMISSION = "files:read"
FILES_WRITE_PERMISSION = "files:write"


def principal_permissions(principal: AuthenticatedPrincipal) -> set[str]:
    return {permission.strip() for permission in principal.permissions if permission.strip()}


def can_manage_admin(principal: AuthenticatedPrincipal) -> bool:
    if principal.is_superadmin:
        return True

    return ADMIN_PERMISSION in principal_permissions(principal)


def can_read_files(principal: AuthenticatedPrincipal) -> bool:
    if principal.is_superadmin:
        return True

    permissions = principal_permissions(principal)
    return FILES_READ_PERMISSION in permissions or FILES_WRITE_PERMISSION in permissions


def can_write_files(principal: AuthenticatedPrincipal) -> bool:
    if principal.is_superadmin:
        return True

    return FILES_WRITE_PERMISSION in principal_permissions(principal)