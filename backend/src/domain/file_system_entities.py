from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from datetime import datetime, timezone
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
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


@dataclass(frozen=True, slots=True)
class DocumentEntry:
    path: AbsolutePath
    size_bytes: int
    kind: NodeKind = field(default=NodeKind.DOCUMENT, init=False)
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))


NodeEntry = DirectoryEntry | DocumentEntry


@dataclass(frozen=True, slots=True)
class DirectoryDetail:
    directory: DirectoryEntry
    children: list[NodeEntry]


@dataclass(frozen=True, slots=True)
class DocumentDetail:
    document: DocumentEntry
    content: str
