from __future__ import annotations

from typing import Annotated, Literal
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, model_validator

from src.domain.access_control import AccessLevel, AccessOverride
from src.domain.auth_entities import AuthenticatedPrincipal, User
from src.domain.file_system_entities import (
    DirectoryDetail,
    DirectoryEntry,
    DocumentDetail,
    DocumentEntry,
    NodeKind,
)
from src.domain.role_entities import ManagedUser, Role

if TYPE_CHECKING:
    from src.application.collaboration_id_store import CollaborationIdStore


class DirectoryNodeResponse(BaseModel):
    kind: Literal["directory"] = "directory"
    path: str
    name: str
    parent_path: str | None
    child_directories_count: int
    child_documents_count: int


class DocumentNodeResponse(BaseModel):
    kind: Literal["document"] = "document"
    path: str
    name: str
    parent_path: str
    size_bytes: int
    collaboration_id: str


NodeResponse = Annotated[DirectoryNodeResponse | DocumentNodeResponse, Field(discriminator="kind")]


class DirectoryResponse(DirectoryNodeResponse):
    children: list[NodeResponse]
    access_level: AccessLevel


class DocumentResponse(DocumentNodeResponse):
    content: str
    access_level: AccessLevel


class CreateDirectoryRequest(BaseModel):
    path: str


class UpdateDirectoryRequest(BaseModel):
    new_path: str


class CreateDocumentRequest(BaseModel):
    path: str
    content: str = ""


class UpdateDocumentRequest(BaseModel):
    new_path: str | None = None
    content: str | None = None

    @model_validator(mode="after")
    def validate_change_set(self) -> "UpdateDocumentRequest":
        if self.new_path is None and self.content is None:
            raise ValueError("At least one document update is required.")

        return self


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str


class AdminProfileResponse(BaseModel):
    id: int
    name: str
    role: str
    roles: list[str]
    permissions: list[str]
    is_superadmin: bool

    @classmethod
    def from_domain(cls, profile: AuthenticatedPrincipal) -> "AdminProfileResponse":
        return cls(
            id=profile.id,
            name=profile.name,
            role=profile.role,
            roles=profile.roles,
            permissions=profile.permissions,
            is_superadmin=profile.is_superadmin,
        )


class UserResponse(BaseModel):
    id: int
    name: str
    roles: list[str]
    permissions: list[str]

    @classmethod
    def from_domain(cls, user: User) -> "UserResponse":
        return cls(id=user.id, name=user.name, roles=user.roles, permissions=user.permissions)


class RoleRequest(BaseModel):
    name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str
    permissions: list[str]

    @classmethod
    def from_domain(cls, role: Role) -> "RoleResponse":
        if role.id is None:
            raise ValueError("Role must have an id before serialization.")

        return cls(
            id=role.id, name=role.name, description=role.description, permissions=role.permissions
        )


class AccessOverrideRequest(BaseModel):
    path: str
    kind: NodeKind
    default_access: AccessLevel | None = None
    role_overrides: dict[str, AccessLevel] = Field(default_factory=dict)


class AccessOverrideResponse(BaseModel):
    path: str
    kind: NodeKind
    default_access: AccessLevel | None
    role_overrides: dict[str, AccessLevel]

    @classmethod
    def from_domain(cls, override: AccessOverride) -> "AccessOverrideResponse":
        return cls(
            path=override.path.value,
            kind=override.kind,
            default_access=override.default_access,
            role_overrides=override.role_overrides,
        )


class CreateManagedUserRequest(BaseModel):
    username: str
    password: str


class ManagedUserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    roles: list[RoleResponse]

    @classmethod
    def from_domain(cls, user: ManagedUser) -> "ManagedUserResponse":
        if user.id is None:
            raise ValueError("User must have an id before serialization.")

        return cls(
            id=user.id,
            username=user.username,
            is_active=user.is_active,
            roles=[RoleResponse.from_domain(role) for role in user.roles],
        )


class RoomStatusResponse(BaseModel):
    initialized: bool


class InitializeRoomRequest(BaseModel):
    seed: str


class InitializeRoomResponse(BaseModel):
    status: str
    message: str | None = None


def serialize_directory_entry(entry: DirectoryEntry) -> DirectoryNodeResponse:
    return DirectoryNodeResponse(
        path=entry.path.value,
        name=entry.path.name,
        parent_path=None if entry.path.is_root else entry.path.parent.value,
        child_directories_count=entry.child_directories_count,
        child_documents_count=entry.child_documents_count,
    )


def serialize_document_entry(entry: DocumentEntry, collaboration_id: str) -> DocumentNodeResponse:
    return DocumentNodeResponse(
        path=entry.path.value,
        name=entry.path.name,
        parent_path=entry.path.parent.value,
        size_bytes=entry.size_bytes,
        collaboration_id=collaboration_id,
    )


def serialize_directory(
    detail: DirectoryDetail,
    *,
    collaboration_id_store: CollaborationIdStore,
    access_level: AccessLevel,
) -> DirectoryResponse:
    directory = serialize_directory_entry(detail.directory)
    children: list[NodeResponse] = []

    for child in detail.children:
        if child.kind == "directory":
            children.append(serialize_directory_entry(child))
        else:
            collab_id = collaboration_id_store.get_or_create(child.path.value)
            children.append(serialize_document_entry(child, collab_id))

    return DirectoryResponse(
        **directory.model_dump(),
        children=children,
        access_level=access_level,
    )


def serialize_document(
    detail: DocumentDetail, collaboration_id: str, access_level: AccessLevel
) -> DocumentResponse:
    document = serialize_document_entry(detail.document, collaboration_id)
    return DocumentResponse(
        **document.model_dump(), content=detail.content, access_level=access_level
    )
