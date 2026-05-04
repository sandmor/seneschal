import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.adapters.http.routes import auth, users


def build_allowed_origins() -> list[str]:
    frontend_url = os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000")
    dev_frontend_url = os.getenv("DEV_FRONTEND_URL", "http://localhost:5173")
    extra_origins_raw = os.getenv("EXTRA_ALLOWED_ORIGINS", "")
    extra_origins = [origin.strip() for origin in extra_origins_raw.split(",") if origin.strip()]

    return [
        frontend_url,
        dev_frontend_url,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        *extra_origins,
    ]


def create_app() -> FastAPI:
    app = FastAPI(title="Seneschal API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)

    @app.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app
