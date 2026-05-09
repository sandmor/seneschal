from __future__ import annotations

from dataclasses import dataclass

from src.application.storage_port import StoragePort
from src.domain.domain_errors import InvalidPathError
from src.domain.file_system_entities import DirectoryDetail, DocumentDetail
from src.domain.paths import AbsolutePath


@dataclass(slots=True)
class DocumentManagementService:
    storage: StoragePort

    def get_directory(self, raw_path: str) -> DirectoryDetail:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()
        return self.storage.read_directory(directory_path)

    def create_directory(self, raw_path: str) -> DirectoryDetail:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()

        if directory_path.is_root:
            raise InvalidPathError("The root directory '/' already exists.")

        return self.storage.create_directory(directory_path)

    def rename_directory(self, raw_path: str, raw_destination_path: str) -> DirectoryDetail:
        source_path = AbsolutePath.parse(raw_path).ensure_directory()
        destination_path = AbsolutePath.parse(raw_destination_path).ensure_directory()

        if source_path.is_root:
            raise InvalidPathError("The root directory '/' cannot be moved or renamed.")

        if destination_path.is_root:
            raise InvalidPathError("The root directory '/' is reserved.")

        if source_path == destination_path:
            raise InvalidPathError("The destination path must be different from the source path.")

        if source_path.is_ancestor_of(destination_path):
            raise InvalidPathError("A directory cannot be moved into one of its own descendants.")

        return self.storage.move_directory(source_path, destination_path)

    def delete_directory(self, raw_path: str, recursive: bool) -> None:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()

        if directory_path.is_root:
            raise InvalidPathError("The root directory '/' cannot be deleted.")

        self.storage.delete_directory(directory_path, recursive=recursive)

    def get_document(self, raw_path: str) -> DocumentDetail:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        return self.storage.read_document(document_path)

    def create_document(self, raw_path: str, content: str) -> DocumentDetail:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        return self.storage.create_document(document_path, content=content)

    def update_document(
        self,
        raw_path: str,
        *,
        content: str | None,
        raw_destination_path: str | None,
    ) -> DocumentDetail:
        document_path = AbsolutePath.parse(raw_path).ensure_document()

        if content is None and raw_destination_path is None:
            raise InvalidPathError("At least one document change must be provided.")

        current_path = document_path

        if raw_destination_path is not None:
            destination_path = AbsolutePath.parse(raw_destination_path).ensure_document()

            if destination_path != document_path:
                current_path = destination_path
                self.storage.move_document(document_path, destination_path)

        if content is not None:
            return self.storage.update_document_content(current_path, content)

        return self.storage.read_document(current_path)

    def delete_document(self, raw_path: str) -> None:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        self.storage.delete_document(document_path)

    def search_documents(self, query: str) -> list[DocumentDetail]:
        if not query or not query.strip():
            raise InvalidPathError("Search query cannot be empty.")
        return self.storage.search_documents(query.strip())

    def copy_document(self, raw_path: str, raw_destination_path: str) -> DocumentDetail:
        source_path = AbsolutePath.parse(raw_path).ensure_document()
        destination_path = AbsolutePath.parse(raw_destination_path).ensure_document()
        if source_path == destination_path:
            raise InvalidPathError("Destination path must be different from source path.")
        return self.storage.copy_document(source_path, destination_path)

    def copy_directory(self, raw_path: str, raw_destination_path: str) -> DirectoryDetail:
        source_path = AbsolutePath.parse(raw_path).ensure_directory()
        destination_path = AbsolutePath.parse(raw_destination_path).ensure_directory()
        if source_path.is_root:
            raise InvalidPathError("The root directory '/' cannot be copied.")
        if source_path == destination_path:
            raise InvalidPathError("Destination path must be different from source path.")
        if source_path.is_ancestor_of(destination_path):
            raise InvalidPathError("A directory cannot be copied into one of its own descendants.")
        return self.storage.copy_directory(source_path, destination_path)
