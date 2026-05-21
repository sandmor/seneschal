from __future__ import annotations

from typing import Iterator

from sqlalchemy import Column, Integer, String, Boolean, Table, ForeignKey
from sqlalchemy.orm import relationship, Session

from src.adapters.database import Base, get_session
from src.application.role_repository import RoleRepository
from src.domain.role_entities import Role, User


# Tabla intermedia para la relación muchos-a-muchos
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)


class RoleModel(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, default="")
    users = relationship("UserModel", secondary=user_roles, back_populates="roles")


class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    roles = relationship("RoleModel", secondary=user_roles, back_populates="users")


class SqlRoleRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    # Roles
    def create_role(self, name: str, description: str = "") -> Role:
        role = RoleModel(name=name, description=description)
        self._session.add(role)
        self._session.commit()
        self._session.refresh(role)
        return Role(id=role.id, name=role.name, description=role.description)

    def get_all_roles(self) -> list[Role]:
        return [
            Role(id=r.id, name=r.name, description=r.description)
            for r in self._session.query(RoleModel).all()
        ]

    def get_role_by_id(self, role_id: int) -> Role | None:
        r = self._session.get(RoleModel, role_id)
        if not r:
            return None
        return Role(id=r.id, name=r.name, description=r.description)

    def update_role(self, role_id: int, name: str, description: str) -> Role | None:
        r = self._session.get(RoleModel, role_id)
        if not r:
            return None
        r.name = name
        r.description = description
        self._session.commit()
        self._session.refresh(r)
        return Role(id=r.id, name=r.name, description=r.description)

    def delete_role(self, role_id: int) -> bool:
        r = self._session.get(RoleModel, role_id)
        if not r:
            return False
        self._session.delete(r)
        self._session.commit()
        return True

    # Users
    def create_user(self, username: str, email: str) -> User:
        user = UserModel(username=username, email=email)
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return User(id=user.id, username=user.username, email=user.email)

    def get_all_users(self) -> list[User]:
        users: list[User] = []
        for u in self._session.query(UserModel).all():
            roles = [Role(id=r.id, name=r.name) for r in u.roles]
            users.append(
                User(id=u.id, username=u.username, email=u.email, is_active=u.is_active, roles=roles)
            )
        return users

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        user = self._session.get(UserModel, user_id)
        role = self._session.get(RoleModel, role_id)
        if not user or not role:
            return False
        if role not in user.roles:
            user.roles.append(role)
            self._session.commit()
        return True

    def revoke_role_from_user(self, user_id: int, role_id: int) -> bool:
        user = self._session.get(UserModel, user_id)
        role = self._session.get(RoleModel, role_id)
        if not user or not role:
            return False
        if role in user.roles:
            user.roles.remove(role)
            self._session.commit()
        return True

    def set_user_active(self, user_id: int, is_active: bool) -> bool:
        user = self._session.get(UserModel, user_id)
        if not user:
            return False
        user.is_active = is_active
        self._session.commit()
        return True


def get_role_repository() -> Iterator[RoleRepository]:
    with get_session() as s:
        yield SqlRoleRepository(s)

