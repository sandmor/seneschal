from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from src.application.role_repository import RoleRepository
from src.adapters.role_repository import get_role_repository


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
def create_role(body: RoleIn, repo: RoleRepository = Depends(get_role_repository)):
    return repo.create_role(body.name, body.description)


@role_router.get("/roles", response_model=list[RoleOut])
def list_roles(repo: RoleRepository = Depends(get_role_repository)):
    return repo.get_all_roles()


@role_router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(role_id: int, body: RoleIn, repo: RoleRepository = Depends(get_role_repository)):
    role = repo.update_role(role_id, body.name, body.description)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@role_router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, repo: RoleRepository = Depends(get_role_repository)):
    if not repo.delete_role(role_id):
        raise HTTPException(status_code=404, detail="Role not found")


@role_router.post("/roles-users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_role_user(body: UserIn, repo: RoleRepository = Depends(get_role_repository)):
    return repo.create_user(body.username, body.email)


@role_router.get("/roles-users", response_model=list[UserOut])
def list_role_users(repo: RoleRepository = Depends(get_role_repository)):
    return repo.get_all_users()


@role_router.post("/roles-users/assign-role", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(body: AssignRoleIn, repo: RoleRepository = Depends(get_role_repository)):
    if not repo.assign_role_to_user(body.user_id, body.role_id):
        raise HTTPException(status_code=404, detail="User or role not found")


@role_router.delete(
    "/roles-users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
def revoke_role(user_id: int, role_id: int, repo: RoleRepository = Depends(get_role_repository)):
    if not repo.revoke_role_from_user(user_id, role_id):
        raise HTTPException(status_code=404, detail="User or role not found")


@role_router.patch("/roles-users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_role_user(user_id: int, repo: RoleRepository = Depends(get_role_repository)):
    if not repo.set_user_active(user_id, False):
        raise HTTPException(status_code=404, detail="User not found")
