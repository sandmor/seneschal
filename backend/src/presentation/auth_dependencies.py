from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from src.application.auth_service import AuthService
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError

logger = logging.getLogger("seneschal.auth")


def create_auth_dependencies(auth_service: AuthService):
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

    def require_current_principal(token: str = Depends(get_token)) -> AuthenticatedPrincipal:
        try:
            return auth_service.get_current_principal(token)
        except InvalidCredentialsError as error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

    def require_admin(token: str = Depends(get_token)) -> AuthenticatedPrincipal:
        try:
            principal = auth_service.get_current_principal(token)
        except InvalidCredentialsError as error:
            logger.warning("Admin access denied: invalid token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

        if not principal.is_superadmin and "admin" not in principal.permissions:
            logger.warning(
                "Admin access denied for user %s: insufficient permissions", principal.username
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin or Superadmin access required.",
            )

        logger.debug("Admin access granted for user %s", principal.username)
        return principal

    return get_token, require_current_principal, require_admin
