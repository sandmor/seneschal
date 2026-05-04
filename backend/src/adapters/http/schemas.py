from pydantic import BaseModel

from src.core.domain.models import AdminProfile, User


class LoginRequestSchema(BaseModel):
    username: str
    password: str


class LoginResponseSchema(BaseModel):
    token: str


class AdminProfileSchema(BaseModel):
    id: int
    name: str
    role: str
    roles: list[str]

    @classmethod
    def from_domain(cls, profile: AdminProfile) -> "AdminProfileSchema":
        return cls(
            id=profile.id,
            name=profile.name,
            role=profile.role,
            roles=profile.roles,
        )

class UserSchema(BaseModel):
    id: int
    name: str
    roles: list[str]

    @classmethod
    def from_domain(cls, user: User) -> "UserSchema":
        return cls(
            id=user.id, 
            name=user.name, 
            roles=user.roles
        )

