from fastapi import APIRouter, Depends, HTTPException

from src.adapters.http.dependencies import get_user_service
from src.adapters.http.schemas import UserSchema
from src.core.application.user_service import UserService

router = APIRouter(prefix="/api", tags=["users"])


# Template, reemplace later
@router.get("/users", response_model=list[UserSchema])
async def get_users(user_service: UserService = Depends(get_user_service)) -> list[UserSchema]:
    try:
        return [UserSchema.from_domain(user) for user in user_service.list_users()]
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
