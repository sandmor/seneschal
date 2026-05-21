from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, select
from sqlalchemy.orm import Session, relationship, selectinload

from src.adapters.database import Base, get_session
from src.application.role_repository import RoleRepository
from src.application.user_repository import UserRepository
from src.domain.auth_entities import User, UserAccount
from src.domain.role_entities import ManagedUser, Role

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
    description = Column(String, default="", nullable=False)
    users = relationship("UserModel", secondary=user_roles, back_populates="roles")


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    roles = relationship("RoleModel", secondary=user_roles, back_populates="users")


def _to_role(role: RoleModel) -> Role:
    return Role(id=role.id, name=role.name, description=role.description)


def _to_user_summary(user: UserModel) -> User:
    return User(id=user.id, name=user.username, roles=[role.name for role in user.roles])


def _to_user_account(user: UserModel) -> UserAccount:
    return UserAccount(
        id=user.id,
        username=user.username,
        password_hash=user.password_hash,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
    )


def _to_managed_user(user: UserModel) -> ManagedUser:
    return ManagedUser(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        roles=[_to_role(role) for role in user.roles],
    )


class SqlAlchemyRoleRepository(RoleRepository):
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_role(self, name: str, description: str = "") -> Role:
        with self._session_factory() as session:
            role = RoleModel(name=name, description=description)
            session.add(role)
            session.commit()
            session.refresh(role)
            return _to_role(role)

    def list_roles(self) -> list[Role]:
        with self._session_factory() as session:
            roles = session.scalars(select(RoleModel).order_by(RoleModel.name)).all()
            return [_to_role(role) for role in roles]

    def update_role(self, role_id: int, name: str, description: str) -> Role | None:
        with self._session_factory() as session:
            role = session.get(RoleModel, role_id)
            if role is None:
                return None

            role.name = name
            role.description = description
            session.commit()
            session.refresh(role)
            return _to_role(role)

    def delete_role(self, role_id: int) -> bool:
        with self._session_factory() as session:
            role = session.get(RoleModel, role_id)
            if role is None:
                return False

            role.users.clear()
            session.delete(role)
            session.commit()
            return True

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        with self._session_factory() as session:
            user = session.get(UserModel, user_id)
            role = session.get(RoleModel, role_id)
            if user is None or role is None:
                return False

            if role not in user.roles:
                user.roles.append(role)
                session.commit()
            return True

    def revoke_role_from_user(self, user_id: int, role_id: int) -> bool:
        with self._session_factory() as session:
            user = session.get(UserModel, user_id)
            role = session.get(RoleModel, role_id)
            if user is None or role is None:
                return False

            if role in user.roles:
                user.roles.remove(role)
                session.commit()
            return True


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_username(self, username: str) -> UserAccount | None:
        with self._session_factory() as session:
            statement = (
                select(UserModel)
                .options(selectinload(UserModel.roles))
                .where(UserModel.username == username)
            )
            user = session.scalars(statement).one_or_none()
            if user is None:
                return None

            return _to_user_account(user)

    def list_users(self) -> list[User]:
        with self._session_factory() as session:
            statement = select(UserModel).options(selectinload(UserModel.roles)).order_by(UserModel.id)
            users = session.scalars(statement).all()
            return [_to_user_summary(user) for user in users]

    def list_managed_users(self) -> list[ManagedUser]:
        with self._session_factory() as session:
            statement = select(UserModel).options(selectinload(UserModel.roles)).order_by(UserModel.id)
            users = session.scalars(statement).all()
            return [_to_managed_user(user) for user in users]

    def create_user(self, username: str, password_hash: str) -> ManagedUser:
        with self._session_factory() as session:
            user = UserModel(username=username, password_hash=password_hash)
            session.add(user)
            session.commit()
            session.refresh(user)
            return _to_managed_user(user)

    def deactivate_user(self, user_id: int) -> bool:
        with self._session_factory() as session:
            user = session.get(UserModel, user_id)
            if user is None:
                return False

            user.is_active = False
            session.commit()
            return True


def create_role_repository() -> RoleRepository:
    return SqlAlchemyRoleRepository(get_session)


def create_user_repository() -> UserRepository:
    return SqlAlchemyUserRepository(get_session)
