from __future__ import annotations

import uuid
from threading import Lock


class CollaborationIdStore:
    """In-memory store mapping document paths to collaboration UUIDs.

    UUIDs are assigned lazily on first access and survive renames within
    a single server session.  They do **not** survive server restarts,
    which is intentional — Yjs rooms are ephemeral.
    """

    def __init__(self) -> None:
        self._path_to_id: dict[str, str] = {}
        self._lock = Lock()

    def get_or_create(self, path: str) -> str:
        """Return the collaboration UUID for *path*, creating one if needed."""
        with self._lock:
            collaboration_id = self._path_to_id.get(path)
            if collaboration_id is None:
                collaboration_id = uuid.uuid4().hex
                self._path_to_id[path] = collaboration_id
            return collaboration_id

    def rename(self, old_path: str, new_path: str) -> None:
        """Transfer the collaboration UUID from *old_path* to *new_path*."""
        with self._lock:
            collaboration_id = self._path_to_id.pop(old_path, None)
            if collaboration_id is not None:
                self._path_to_id[new_path] = collaboration_id

    def rename_directory(self, old_dir_path: str, new_dir_path: str) -> None:
        """Transfer collaboration UUIDs for all documents within a directory."""
        if not old_dir_path.endswith("/"):
            old_dir_path += "/"
        if not new_dir_path.endswith("/"):
            new_dir_path += "/"

        with self._lock:
            keys_to_update = [k for k in self._path_to_id.keys() if k.startswith(old_dir_path)]
            for old_key in keys_to_update:
                new_key = new_dir_path + old_key[len(old_dir_path) :]
                self._path_to_id[new_key] = self._path_to_id.pop(old_key)

    def delete(self, path: str) -> None:
        """Remove the collaboration UUID for *path*, if any."""
        with self._lock:
            self._path_to_id.pop(path, None)

    def delete_directory(self, dir_path: str) -> None:
        """Remove the collaboration UUIDs for all documents within a directory."""
        if not dir_path.endswith("/"):
            dir_path += "/"

        with self._lock:
            keys_to_delete = [k for k in self._path_to_id.keys() if k.startswith(dir_path)]
            for key in keys_to_delete:
                self._path_to_id.pop(key, None)
