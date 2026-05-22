from __future__ import annotations

import logging
from dataclasses import dataclass

from src.application.storage_port import StoragePort
from src.domain.domain_errors import InvalidPathError
from src.domain.file_system_entities import DirectoryDetail, DocumentDetail
from src.domain.paths import AbsolutePath

logger = logging.getLogger("seneschal.documents")


@dataclass(slots=True)
class DocumentManagementService:
    storage: StoragePort

    def get_directory(self, raw_path: str) -> DirectoryDetail:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()
        logger.debug("Get directory: %s", directory_path.value)
        return self.storage.read_directory(directory_path)

    def create_directory(self, raw_path: str) -> DirectoryDetail:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()

        if directory_path.is_root:
            logger.warning("Attempted to create root directory")
            raise InvalidPathError("The root directory '/' already exists.")

        logger.info("Create directory: %s", directory_path.value)
        return self.storage.create_directory(directory_path)

    def rename_directory(self, raw_path: str, raw_destination_path: str) -> DirectoryDetail:
        source_path = AbsolutePath.parse(raw_path).ensure_directory()
        destination_path = AbsolutePath.parse(raw_destination_path).ensure_directory()

        if source_path.is_root:
            logger.warning("Attempted to rename root directory")
            raise InvalidPathError("The root directory '/' cannot be moved or renamed.")

        if destination_path.is_root:
            logger.warning("Attempted to rename directory to root")
            raise InvalidPathError("The root directory '/' is reserved.")

        if source_path == destination_path:
            logger.warning("Source and destination are identical: %s", source_path.value)
            raise InvalidPathError("The destination path must be different from the source path.")

        if source_path.is_ancestor_of(destination_path):
            logger.warning(
                "Attempted to move directory into its own descendant: %s -> %s",
                source_path.value,
                destination_path.value,
            )
            raise InvalidPathError("A directory cannot be moved into one of its own descendants.")

        logger.info("Rename directory: %s -> %s", source_path.value, destination_path.value)
        return self.storage.move_directory(source_path, destination_path)

    def delete_directory(self, raw_path: str, recursive: bool) -> None:
        directory_path = AbsolutePath.parse(raw_path).ensure_directory()

        if directory_path.is_root:
            logger.warning("Attempted to delete root directory")
            raise InvalidPathError("The root directory '/' cannot be deleted.")

        logger.info("Delete directory: %s (recursive=%s)", directory_path.value, recursive)
        self.storage.delete_directory(directory_path, recursive=recursive)

    def get_document(self, raw_path: str) -> DocumentDetail:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        logger.debug("Get document: %s", document_path.value)
        return self.storage.read_document(document_path)

    def create_document(self, raw_path: str, content: str) -> DocumentDetail:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        logger.info("Create document: %s", document_path.value)
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
            logger.warning("No changes provided for document update: %s", document_path.value)
            raise InvalidPathError("At least one document change must be provided.")

        current_path = document_path

        if raw_destination_path is not None:
            destination_path = AbsolutePath.parse(raw_destination_path).ensure_document()

            if destination_path != document_path:
                logger.info(
                    "Move document: %s -> %s", document_path.value, destination_path.value
                )
                current_path = destination_path
                self.storage.move_document(document_path, destination_path)

        if content is not None:
            logger.debug("Update document content: %s", current_path.value)
            return self.storage.update_document_content(current_path, content)

        return self.storage.read_document(current_path)

    def delete_document(self, raw_path: str) -> None:
        document_path = AbsolutePath.parse(raw_path).ensure_document()
        logger.info("Delete document: %s", document_path.value)
        self.storage.delete_document(document_path)
