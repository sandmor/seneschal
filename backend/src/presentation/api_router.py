from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from src.application.document_management_service import DocumentManagementService
from src.presentation.api_schemas import (
    CreateDirectoryRequest,
    CreateDocumentRequest,
    DirectoryResponse,
    DocumentResponse,
    UpdateDirectoryRequest,
    UpdateDocumentRequest,
    serialize_directory,
    serialize_document,
)


def create_api_router(service: DocumentManagementService) -> APIRouter:
    router = APIRouter()

    @router.get("/health", tags=["system"])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

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

    return router
