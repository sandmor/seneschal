from __future__ import annotations

from typing import Protocol

from src.domain.file_system_entities import DirectoryDetail, DocumentDetail
from src.domain.paths import AbsolutePath


class StoragePort(Protocol):
    def read_directory(self, path: AbsolutePath) -> DirectoryDetail: ...

    def read_document(self, path: AbsolutePath) -> DocumentDetail: ...

    def create_directory(self, path: AbsolutePath) -> DirectoryDetail: ...

    def create_document(self, path: AbsolutePath, content: str) -> DocumentDetail: ...

    def update_document_content(self, path: AbsolutePath, content: str) -> DocumentDetail: ...

    def move_directory(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DirectoryDetail: ...

    def move_document(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DocumentDetail: ...

    def delete_directory(self, path: AbsolutePath, recursive: bool) -> None: ...

    def delete_document(self, path: AbsolutePath) -> None: ...

    def search_documents(self, query: str) -> list[DocumentDetail]: ...

    def copy_document(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DocumentDetail: ...

    def copy_directory(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DirectoryDetail: ...
