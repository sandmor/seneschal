from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from fastapi import FastAPI, Request, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from src.adapters.in_memory_token_store import InMemoryTokenStore
from src.adapters.local_storage import LocalStorageAdapter
from src.application.auth_service import AuthService
from src.application.document_management_service import DocumentManagementService
from src.application.user_service import UserService
from src.domain.domain_errors import (
    DirectoryNotEmptyError,
    InvalidPathError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
)
from src.presentation.api_router import create_api_router
from src.presentation.websocket_handler import handle_document_websocket, websocket_server


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Manage the application lifespan events, like starting the websocket server."""
    async with websocket_server:
        yield


def create_app() -> FastAPI:
    _load_root_env()

    storage = LocalStorageAdapter(_resolve_data_directory())
    service = DocumentManagementService(storage=storage)
    token_store = InMemoryTokenStore()
    auth_service = AuthService(
        admin_username=os.getenv("ADMIN_USERNAME", "admin"),
        admin_password=os.getenv("ADMIN_PASSWORD", "admin123"),
        token_store=token_store,
    )
    user_service = UserService()

    app = FastAPI(
        title="Seneschal API",
        summary="Document management API for directories, markdown documents, and authentication.",
        lifespan=lifespan,
    )

    logger = logging.getLogger("seneschal")
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    app.logger = logger

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(create_api_router(service, auth_service, user_service, token_store))

    @app.middleware("http")
    async def log_request_url(request: Request, call_next):
        app.logger.info(f"Incoming request URL: {request.url}")
        response = await call_next(request)
        return response

    @app.websocket("/ws/documents/{path:path}")
    async def document_websocket(websocket: WebSocket, path: str) -> None:
        await handle_document_websocket(websocket, path)

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


def _build_allowed_origins() -> list[str]:
    frontend_port = os.getenv("FRONTEND_PORT", "3000")
    public_frontend_url = os.getenv("PUBLIC_FRONTEND_URL")
    candidates = [
        f"http://127.0.0.1:{frontend_port}",
        f"http://localhost:{frontend_port}",
    ]

    if public_frontend_url:
        candidates.append(public_frontend_url)
        parsed = urlsplit(public_frontend_url)
        if parsed.scheme and parsed.port and parsed.hostname in {"127.0.0.1", "localhost"}:
            alternate_host = "localhost" if parsed.hostname == "127.0.0.1" else "127.0.0.1"
            candidates.append(
                urlunsplit((parsed.scheme, f"{alternate_host}:{parsed.port}", parsed.path, "", ""))
            )

    extra_origins = os.getenv("EXTRA_ALLOWED_ORIGINS", "")

    candidates.extend(origin.strip() for origin in extra_origins.split(",") if origin.strip())

    return list(dict.fromkeys(candidates))


def _error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail})


def _load_root_env() -> None:
    root_env_path = Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(root_env_path, override=False)
