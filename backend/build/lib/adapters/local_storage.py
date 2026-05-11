from __future__ import annotations

import shutil
from pathlib import Path

from src.domain.domain_errors import (
    DirectoryNotEmptyError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
)
from src.domain.file_system_entities import (
    DirectoryDetail,
    DirectoryEntry,
    DocumentDetail,
    DocumentEntry,
    NodeEntry,
)
from src.domain.paths import AbsolutePath


class LocalStorageAdapter:
    def __init__(self, base_directory: Path) -> None:
        self._base_directory = base_directory
        self._base_directory.mkdir(parents=True, exist_ok=True)

    def read_directory(self, path: AbsolutePath) -> DirectoryDetail:
        directory_path = self._require_existing_directory(path)
        directory_entry = self._build_directory_entry(path, directory_path)

        children: list[NodeEntry] = []

        for child_path in self._iter_supported_children(path, directory_path):
            child_relative_path = path.segments + (child_path.name,)
            child_absolute_path = AbsolutePath(child_relative_path)

            if child_path.is_dir():
                children.append(self._build_directory_entry(child_absolute_path, child_path))
            else:
                children.append(self._build_document_entry(child_absolute_path, child_path))

        return DirectoryDetail(directory=directory_entry, children=children)

    def read_document(self, path: AbsolutePath) -> DocumentDetail:
        document_path = self._require_existing_document(path)
        content = document_path.read_text(encoding="utf-8")
        document_entry = self._build_document_entry(path, document_path)
        return DocumentDetail(document=document_entry, content=content)

    def create_directory(self, path: AbsolutePath) -> DirectoryDetail:
        fs_path = self._fs_path_for(path)

        if fs_path.exists():
            raise ResourceAlreadyExistsError(f"Directory '{path.value}' already exists.")

        parent_path = self._require_existing_directory(path.parent)
        if not parent_path.is_dir():
            raise ResourceNotFoundError(f"Parent directory '{path.parent.value}' was not found.")

        fs_path.mkdir()
        return self.read_directory(path)

    def create_document(self, path: AbsolutePath, content: str) -> DocumentDetail:
        fs_path = self._fs_path_for(path)

        if fs_path.exists():
            raise ResourceAlreadyExistsError(f"Document '{path.value}' already exists.")

        self._require_existing_directory(path.parent)
        fs_path.write_text(content, encoding="utf-8")
        return self.read_document(path)

    def update_document_content(self, path: AbsolutePath, content: str) -> DocumentDetail:
        fs_path = self._require_existing_document(path)
        fs_path.write_text(content, encoding="utf-8")
        return self.read_document(path)

    def move_directory(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DirectoryDetail:
        source_fs_path = self._require_existing_directory(source_path)
        destination_fs_path = self._fs_path_for(destination_path)

        if destination_fs_path.exists():
            raise ResourceAlreadyExistsError(
                f"Destination directory '{destination_path.value}' already exists."
            )

        self._require_existing_directory(destination_path.parent)
        source_fs_path.rename(destination_fs_path)
        return self.read_directory(destination_path)

    def move_document(
        self, source_path: AbsolutePath, destination_path: AbsolutePath
    ) -> DocumentDetail:
        source_fs_path = self._require_existing_document(source_path)
        destination_fs_path = self._fs_path_for(destination_path)

        if destination_fs_path.exists():
            raise ResourceAlreadyExistsError(
                f"Destination document '{destination_path.value}' already exists."
            )

        self._require_existing_directory(destination_path.parent)
        source_fs_path.rename(destination_fs_path)
        return self.read_document(destination_path)

    def delete_directory(self, path: AbsolutePath, recursive: bool) -> None:
        fs_path = self._require_existing_directory(path)

        if recursive:
            shutil.rmtree(fs_path)
            return

        try:
            fs_path.rmdir()
        except OSError as error:
            raise DirectoryNotEmptyError(
                f"Directory '{path.value}' is not empty; delete recursively to remove it."
            ) from error

    def delete_document(self, path: AbsolutePath) -> None:
        fs_path = self._require_existing_document(path)
        fs_path.unlink()

    def _fs_path_for(self, path: AbsolutePath) -> Path:
        return self._base_directory.joinpath(*path.segments)

    def _require_existing_directory(self, path: AbsolutePath) -> Path:
        fs_path = self._fs_path_for(path)

        if not fs_path.exists() or not fs_path.is_dir():
            raise ResourceNotFoundError(f"Directory '{path.value}' was not found.")

        return fs_path

    def _require_existing_document(self, path: AbsolutePath) -> Path:
        fs_path = self._fs_path_for(path)

        if not fs_path.exists() or not fs_path.is_file():
            raise ResourceNotFoundError(f"Document '{path.value}' was not found.")

        return fs_path

    def _build_directory_entry(self, path: AbsolutePath, directory_path: Path) -> DirectoryEntry:
        child_directories_count = 0
        child_documents_count = 0

        for child_path in self._iter_supported_children(path, directory_path):
            if child_path.is_dir():
                child_directories_count += 1
            else:
                child_documents_count += 1

        return DirectoryEntry(
            path=path,
            child_directories_count=child_directories_count,
            child_documents_count=child_documents_count,
        )

    def _build_document_entry(self, path: AbsolutePath, document_path: Path) -> DocumentEntry:
        return DocumentEntry(path=path, size_bytes=document_path.stat().st_size)

    def _iter_supported_children(self, path: AbsolutePath, directory_path: Path) -> list[Path]:
        children: list[Path] = []

        for child_path in directory_path.iterdir():
            if child_path.is_dir():
                children.append(child_path)
                continue

            if child_path.is_file() and child_path.suffix == ".md" and not path.is_root:
                children.append(child_path)

        return sorted(children, key=self._sort_key)

    @staticmethod
    def _sort_key(path: Path) -> tuple[int, str, str]:
        return (0 if path.is_dir() else 1, path.name.casefold(), path.name)
