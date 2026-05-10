from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from src.adapters.database import get_session
from src.adapters import role_repository as repo


# --- Schemas ---


class RoleIn(BaseModel):
    name: str
    description: str = ""


class RoleOut(BaseModel):
    id: int
    name: str
    description: str


class UserIn(BaseModel):
    username: str
    email: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    roles: list[RoleOut] = []


class AssignRoleIn(BaseModel):
    user_id: int
    role_id: int


# --- Router ---

role_router = APIRouter(prefix="/api", tags=["roles"])


@role_router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(body: RoleIn):
    with get_session() as s:
        return repo.create_role(s, body.name, body.description)


@role_router.get("/roles", response_model=list[RoleOut])
def list_roles():
    with get_session() as s:
        return repo.get_all_roles(s)


@role_router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(role_id: int, body: RoleIn):
    with get_session() as s:
        role = repo.update_role(s, role_id, body.name, body.description)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        return role


@role_router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int):
    with get_session() as s:
        if not repo.delete_role(s, role_id):
            raise HTTPException(status_code=404, detail="Role not found")


@role_router.post("/roles-users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_role_user(body: UserIn):
    with get_session() as s:
        return repo.create_user(s, body.username, body.email)


@role_router.get("/roles-users", response_model=list[UserOut])
def list_role_users():
    with get_session() as s:
        return repo.get_all_users(s)


@role_router.post("/roles-users/assign-role", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(body: AssignRoleIn):
    with get_session() as s:
        if not repo.assign_role_to_user(s, body.user_id, body.role_id):
            raise HTTPException(status_code=404, detail="User or role not found")


@role_router.delete(
    "/roles-users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
def revoke_role(user_id: int, role_id: int):
    with get_session() as s:
        if not repo.revoke_role_from_user(s, user_id, role_id):
            raise HTTPException(status_code=404, detail="User or role not found")


@role_router.patch("/roles-users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_role_user(user_id: int):
    with get_session() as s:
        if not repo.set_user_active(s, user_id, False):
            raise HTTPException(status_code=404, detail="User not found")
