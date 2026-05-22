from __future__ import annotations

import base64
import logging
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Response, status, Depends

from src.application.auth_service import AuthService
from src.application.collaboration_id_store import CollaborationIdStore
from src.application.document_management_service import DocumentManagementService
from src.application.user_service import UserService
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import InvalidCredentialsError
from src.presentation.api_schemas import (
    AdminProfileResponse,
    CreateDirectoryRequest,
    CreateDocumentRequest,
    DirectoryResponse,
    DocumentResponse,
    InitializeRoomRequest,
    InitializeRoomResponse,
    LoginRequest,
    LoginResponse,
    RoomStatusResponse,
    UpdateDirectoryRequest,
    UpdateDocumentRequest,
    UserResponse,
    serialize_directory,
    serialize_document,
)
from src.presentation.websocket_handler import DocumentCollaborationHandler

logger = logging.getLogger("seneschal.api")


def create_api_router(
    service: DocumentManagementService,
    auth_service: AuthService,
    user_service: UserService,
    collaboration_id_store: CollaborationIdStore,
    collaboration_handler: DocumentCollaborationHandler,
) -> APIRouter:
    router = APIRouter()

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

    secured_router = APIRouter(dependencies=[Depends(require_current_principal)])

    @router.get("/health", tags=["system"])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @router.post("/api/auth/login", response_model=LoginResponse, tags=["auth"])
    async def login(request: LoginRequest) -> LoginResponse:
        logger.info("Login attempt for user: %s", request.username)
        try:
            token = auth_service.login(request.username, request.password)
        except InvalidCredentialsError as error:
            logger.warning("Failed login for user: %s", request.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(error),
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

        logger.info("Successful login for user: %s", request.username)
        return LoginResponse(token=token)

    @secured_router.post("/api/auth/logout", tags=["auth"])
    async def logout(token: str = Depends(get_token)) -> dict[str, str]:
        auth_service.logout(token)
        logger.info("Logout performed")
        return {"status": "ok"}

    @secured_router.get("/api/auth/me", response_model=AdminProfileResponse, tags=["auth"])
    async def get_profile(
        principal: AuthenticatedPrincipal = Depends(require_current_principal),
    ) -> AdminProfileResponse:
        return AdminProfileResponse.from_domain(principal)

    @secured_router.get("/api/users", response_model=list[UserResponse], tags=["users"])
    async def get_users() -> list[UserResponse]:
        users = user_service.list_users()
        logger.info("Listed %d users", len(users))
        return [UserResponse.from_domain(user) for user in users]

    @secured_router.get("/api/directories", response_model=DirectoryResponse, tags=["directories"])
    async def get_directory(path: str = Query(default="/")) -> DirectoryResponse:
        logger.debug("Get directory: %s", path)
        return serialize_directory(
            service.get_directory(path),
            collaboration_id_store=collaboration_id_store,
        )

    @secured_router.post(
        "/api/directories",
        response_model=DirectoryResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["directories"],
    )
    async def create_directory(request: CreateDirectoryRequest) -> DirectoryResponse:
        logger.info("Create directory: %s", request.path)
        return serialize_directory(
            service.create_directory(request.path),
            collaboration_id_store=collaboration_id_store,
        )

    @secured_router.patch(
        "/api/directories", response_model=DirectoryResponse, tags=["directories"]
    )
    async def update_directory(
        request: UpdateDirectoryRequest,
        path: str = Query(...),
    ) -> DirectoryResponse:
        logger.info("Rename directory: %s -> %s", path, request.new_path)
        collaboration_id_store.rename_directory(path, request.new_path)
        return serialize_directory(
            service.rename_directory(path, request.new_path),
            collaboration_id_store=collaboration_id_store,
        )

    @secured_router.delete(
        "/api/directories", status_code=status.HTTP_204_NO_CONTENT, tags=["directories"]
    )
    async def delete_directory(
        path: str = Query(...),
        recursive: bool = Query(default=False),
    ) -> Response:
        logger.info("Delete directory: %s (recursive=%s)", path, recursive)
        service.delete_directory(path, recursive=recursive)
        collaboration_id_store.delete_directory(path)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @secured_router.get("/api/documents", response_model=DocumentResponse, tags=["documents"])
    async def get_document(path: str = Query(...)) -> DocumentResponse:
        logger.debug("Get document: %s", path)
        detail = service.get_document(path)
        collab_id = collaboration_id_store.get_or_create(path)
        return serialize_document(detail, collab_id)

    @secured_router.post(
        "/api/documents",
        response_model=DocumentResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["documents"],
    )
    async def create_document(request: CreateDocumentRequest) -> DocumentResponse:
        logger.info("Create document: %s", request.path)
        detail = service.create_document(request.path, request.content)
        collab_id = collaboration_id_store.get_or_create(detail.document.path.value)
        return serialize_document(detail, collab_id)

    @secured_router.patch("/api/documents", response_model=DocumentResponse, tags=["documents"])
    async def update_document(
        request: UpdateDocumentRequest,
        path: str = Query(...),
    ) -> DocumentResponse:
        logger.info("Update document: %s", path)
        if request.new_path and request.new_path != path:
            collaboration_id_store.rename(path, request.new_path)
        detail = service.update_document(
            path,
            content=request.content,
            raw_destination_path=request.new_path,
        )
        collab_id = collaboration_id_store.get_or_create(detail.document.path.value)
        return serialize_document(detail, collab_id)

    @secured_router.delete(
        "/api/documents", status_code=status.HTTP_204_NO_CONTENT, tags=["documents"]
    )
    async def delete_document(path: str = Query(...)) -> Response:
        logger.info("Delete document: %s", path)
        service.delete_document(path)
        collaboration_id_store.delete(path)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @secured_router.get(
        "/api/rooms/{collaboration_id}/status",
        response_model=RoomStatusResponse,
        tags=["rooms"],
    )
    async def check_room_status_endpoint(collaboration_id: str) -> RoomStatusResponse:
        logger.debug("Check room status: %s", collaboration_id)
        result = await collaboration_handler.check_room_status(collaboration_id)
        return RoomStatusResponse(**result)

    @secured_router.post(
        "/api/rooms/{collaboration_id}/initialize",
        response_model=InitializeRoomResponse,
        tags=["rooms"],
    )
    async def initialize_room_endpoint(
        collaboration_id: str,
        request: InitializeRoomRequest,
    ) -> InitializeRoomResponse:
        logger.info("Initialize room: %s", collaboration_id)
        try:
            seed = base64.b64decode(request.seed)
        except Exception as error:
            logger.warning("Invalid base64 seed for room %s", collaboration_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 seed.",
            ) from error

        result = await collaboration_handler.initialize_room(collaboration_id, seed)
        logger.info("Room %s initialized", collaboration_id)
        return InitializeRoomResponse(**result)

    router.include_router(secured_router)
    return router
