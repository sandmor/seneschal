
from __future__ import annotations
from sqlalchemy import Column, Integer, String, Boolean, Table, ForeignKey
from sqlalchemy.orm import relationship, Session
from src.adapters.database import Base
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


# --- Funciones CRUD para Roles ---

def create_role(session: Session, name: str, description: str = "") -> Role:
    role = RoleModel(name=name, description=description)
    session.add(role)
    session.commit()
    session.refresh(role)
    return Role(id=role.id, name=role.name, description=role.description)


def get_all_roles(session: Session) -> list[Role]:
    return [
        Role(id=r.id, name=r.name, description=r.description)
        for r in session.query(RoleModel).all()
    ]


def get_role_by_id(session: Session, role_id: int) -> Role | None:
    r = session.get(RoleModel, role_id)
    if not r:
        return None
    return Role(id=r.id, name=r.name, description=r.description)


def update_role(session: Session, role_id: int, name: str, description: str) -> Role | None:
    r = session.get(RoleModel, role_id)
    if not r:
        return None
    r.name = name
    r.description = description
    session.commit()
    session.refresh(r)
    return Role(id=r.id, name=r.name, description=r.description)


def delete_role(session: Session, role_id: int) -> bool:
    r = session.get(RoleModel, role_id)
    if not r:
        return False
    session.delete(r)
    session.commit()
    return True


# --- Funciones CRUD para Usuarios ---

def create_user(session: Session, username: str, email: str) -> User:
    user = UserModel(username=username, email=email)
    session.add(user)
    session.commit()
    session.refresh(user)
    return User(id=user.id, username=user.username, email=user.email)


def get_all_users(session: Session) -> list[User]:
    users = []
    for u in session.query(UserModel).all():
        roles = [Role(id=r.id, name=r.name) for r in u.roles]
        users.append(User(id=u.id, username=u.username, email=u.email,
                          is_active=u.is_active, roles=roles))
    return users


def assign_role_to_user(session: Session, user_id: int, role_id: int) -> bool:
    user = session.get(UserModel, user_id)
    role = session.get(RoleModel, role_id)
    if not user or not role:
        return False
    if role not in user.roles:
        user.roles.append(role)
        session.commit()
    return True


def revoke_role_from_user(session: Session, user_id: int, role_id: int) -> bool:
    user = session.get(UserModel, user_id)
    role = session.get(RoleModel, role_id)
    if not user or not role:
        return False
    if role in user.roles:
        user.roles.remove(role)
        session.commit()
    return True


def set_user_active(session: Session, user_id: int, is_active: bool) -> bool:
    user = session.get(UserModel, user_id)
    if not user:
        return False
    user.is_active = is_active
    session.commit()
    return True