from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from src.domain.paths import AbsolutePath


class NodeKind(StrEnum):
    DIRECTORY = "directory"
    DOCUMENT = "document"


@dataclass(frozen=True, slots=True)
class DirectoryEntry:
    path: AbsolutePath
    child_directories_count: int
    child_documents_count: int
    kind: NodeKind = field(default=NodeKind.DIRECTORY, init=False)


@dataclass(frozen=True, slots=True)
class DocumentEntry:
    path: AbsolutePath
    size_bytes: int
    kind: NodeKind = field(default=NodeKind.DOCUMENT, init=False)


NodeEntry = DirectoryEntry | DocumentEntry


@dataclass(frozen=True, slots=True)
class DirectoryDetail:
    directory: DirectoryEntry
    children: list[NodeEntry]


@dataclass(frozen=True, slots=True)
class DocumentDetail:
    document: DocumentEntry
    content: str
