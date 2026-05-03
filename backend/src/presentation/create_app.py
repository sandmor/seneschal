from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.adapters.local_storage import LocalStorageAdapter
from src.application.document_management_service import DocumentManagementService
from src.domain.domain_errors import (
    DirectoryNotEmptyError,
    InvalidPathError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
)
from src.presentation.api_router import create_api_router


def create_app() -> FastAPI:
    _load_root_env()

    storage = LocalStorageAdapter(_resolve_data_directory())
    service = DocumentManagementService(storage=storage)

    app = FastAPI(
        title="Seneschal API",
        summary="Document management API for directories and markdown documents.",
    )

    frontend_url = os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(create_api_router(service))

    @app.exception_handler(InvalidPathError)
    async def handle_invalid_path(_: Request, error: InvalidPathError) -> JSONResponse:
        return _error_response(status.HTTP_400_BAD_REQUEST, str(error))

    @app.exception_handler(ResourceNotFoundError)
    async def handle_not_found(_: Request, error: ResourceNotFoundError) -> JSONResponse:
        return _error_response(status.HTTP_404_NOT_FOUND, str(error))

    @app.exception_handler(ResourceAlreadyExistsError)
    async def handle_conflict(_: Request, error: ResourceAlreadyExistsError) -> JSONResponse:
        return _error_response(status.HTTP_409_CONFLICT, str(error))

    @app.exception_handler(DirectoryNotEmptyError)
    async def handle_directory_not_empty(_: Request, error: DirectoryNotEmptyError) -> JSONResponse:
        return _error_response(status.HTTP_409_CONFLICT, str(error))

    return app


def _resolve_data_directory() -> Path:
    return Path(os.getenv("DATA_DIRECTORY", "data")).resolve()


def _error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail})


def _load_root_env() -> None:
    root_env_path = Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(root_env_path, override=False)
