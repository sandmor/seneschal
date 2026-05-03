from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from src.domain.file_system_entities import (
    DirectoryDetail,
    DirectoryEntry,
    DocumentDetail,
    DocumentEntry,
)


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


NodeResponse = Annotated[DirectoryNodeResponse | DocumentNodeResponse, Field(discriminator="kind")]


class DirectoryResponse(DirectoryNodeResponse):
    children: list[NodeResponse]


class DocumentResponse(DocumentNodeResponse):
    content: str


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


def serialize_directory_entry(entry: DirectoryEntry) -> DirectoryNodeResponse:
    return DirectoryNodeResponse(
        path=entry.path.value,
        name=entry.path.name,
        parent_path=None if entry.path.is_root else entry.path.parent.value,
        child_directories_count=entry.child_directories_count,
        child_documents_count=entry.child_documents_count,
    )


def serialize_document_entry(entry: DocumentEntry) -> DocumentNodeResponse:
    return DocumentNodeResponse(
        path=entry.path.value,
        name=entry.path.name,
        parent_path=entry.path.parent.value,
        size_bytes=entry.size_bytes,
    )


def serialize_directory(detail: DirectoryDetail) -> DirectoryResponse:
    directory = serialize_directory_entry(detail.directory)
    children: list[NodeResponse] = []

    for child in detail.children:
        if child.kind == "directory":
            children.append(serialize_directory_entry(child))
        else:
            children.append(serialize_document_entry(child))

    return DirectoryResponse(**directory.model_dump(), children=children)


def serialize_document(detail: DocumentDetail) -> DocumentResponse:
    document = serialize_document_entry(detail.document)
    return DocumentResponse(**document.model_dump(), content=detail.content)
