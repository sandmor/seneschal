from fastapi import APIRouter, Depends, HTTPException

from src.adapters.http.dependencies import get_auth_service, require_bearer_token
from src.adapters.http.schemas import AdminProfileSchema, LoginRequestSchema, LoginResponseSchema
from src.core.application.auth_service import AuthService
from src.core.domain.errors import InvalidCredentialsError

router = APIRouter(prefix="/api/auth", tags=["auth"])

# TODO: Reemplaze with an actual BD
@router.post("/login", response_model=LoginResponseSchema)
async def login(
    payload: LoginRequestSchema,
    auth_service: AuthService = Depends(get_auth_service),
) -> LoginResponseSchema:
    try:
        token = auth_service.login(payload.username, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return LoginResponseSchema(token=token)


@router.post("/logout")
async def logout(
    token: str = Depends(require_bearer_token),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    auth_service.logout(token)
    return {"status": "ok"}


@router.get("/me", response_model=AdminProfileSchema)
async def get_profile(
    _: str = Depends(require_bearer_token),
    auth_service: AuthService = Depends(get_auth_service),
) -> AdminProfileSchema:
    profile = auth_service.get_admin_profile()
    return AdminProfileSchema.from_domain(profile)


