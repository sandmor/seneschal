from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Header, Query, Response, status

from src.application.auth_service import AuthService
from src.application.document_management_service import DocumentManagementService
from src.application.token_store import TokenStore
from src.application.user_service import UserService
from src.domain.domain_errors import InvalidCredentialsError
from src.presentation.api_schemas import (
    AdminProfileResponse,
    CreateDirectoryRequest,
    CreateDocumentRequest,
    DirectoryResponse,
    DocumentResponse,
    LoginRequest,
    LoginResponse,
    UpdateDirectoryRequest,
    UpdateDocumentRequest,
    UserResponse,
    serialize_directory,
    serialize_document,
)


def create_api_router(
    service: DocumentManagementService,
    auth_service: AuthService,
    user_service: UserService,
    token_store: TokenStore,
) -> APIRouter:
    router = APIRouter()

    def require_bearer_token(authorization: str | None) -> str:
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

        if not token_store.contains(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return token

    @router.get("/health", tags=["system"])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @router.post("/api/auth/login", response_model=LoginResponse, tags=["auth"])
    async def login(request: LoginRequest) -> LoginResponse:
        try:
            token = auth_service.login(request.username, request.password)
        except InvalidCredentialsError as error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(error),
                headers={"WWW-Authenticate": "Bearer"},
            ) from error

        return LoginResponse(token=token)

    @router.post("/api/auth/logout", tags=["auth"])
    async def logout(
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, str]:
        token = require_bearer_token(authorization)
        auth_service.logout(token)
        return {"status": "ok"}

    @router.get("/api/auth/me", response_model=AdminProfileResponse, tags=["auth"])
    async def get_profile(
        authorization: Annotated[str | None, Header()] = None,
    ) -> AdminProfileResponse:
        require_bearer_token(authorization)
        return AdminProfileResponse.from_domain(auth_service.get_admin_profile())

    @router.get("/api/users", response_model=list[UserResponse], tags=["users"])
    async def get_users(
        authorization: Annotated[str | None, Header()] = None,
    ) -> list[UserResponse]:
        require_bearer_token(authorization)
        return [UserResponse.from_domain(user) for user in user_service.list_users()]

    @router.get("/api/directories", response_model=DirectoryResponse, tags=["directories"])
    async def get_directory(path: str = Query(default="/")) -> DirectoryResponse:
        return serialize_directory(service.get_directory(path))

    @router.post(
        "/api/directories",
        response_model=DirectoryResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["directories"],
    )
    async def create_directory(request: CreateDirectoryRequest) -> DirectoryResponse:
        return serialize_directory(service.create_directory(request.path))

    @router.patch("/api/directories", response_model=DirectoryResponse, tags=["directories"])
    async def update_directory(
        request: UpdateDirectoryRequest,
        path: str = Query(...),
    ) -> DirectoryResponse:
        return serialize_directory(service.rename_directory(path, request.new_path))

    @router.delete("/api/directories", status_code=status.HTTP_204_NO_CONTENT, tags=["directories"])
    async def delete_directory(
        path: str = Query(...),
        recursive: bool = Query(default=False),
    ) -> Response:
        service.delete_directory(path, recursive=recursive)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get("/api/documents", response_model=DocumentResponse, tags=["documents"])
    async def get_document(path: str = Query(...)) -> DocumentResponse:
        return serialize_document(service.get_document(path))

    @router.post(
        "/api/documents",
        response_model=DocumentResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["documents"],
    )
    async def create_document(request: CreateDocumentRequest) -> DocumentResponse:
        return serialize_document(service.create_document(request.path, request.content))

    @router.patch("/api/documents", response_model=DocumentResponse, tags=["documents"])
    async def update_document(
        request: UpdateDocumentRequest,
        path: str = Query(...),
    ) -> DocumentResponse:
        return serialize_document(
            service.update_document(
                path,
                content=request.content,
                raw_destination_path=request.new_path,
            )
        )

    @router.delete("/api/documents", status_code=status.HTTP_204_NO_CONTENT, tags=["documents"])
    async def delete_document(path: str = Query(...)) -> Response:
        service.delete_document(path)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get("/api/search", response_model=list[DocumentResponse], tags=["documents"])
    async def search_documents(q: str = Query(..., min_length=1)) -> list[DocumentResponse]:
        return [serialize_document(doc) for doc in service.search_documents(q)]

    return router
