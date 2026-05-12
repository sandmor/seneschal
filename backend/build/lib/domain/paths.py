from __future__ import annotations

from dataclasses import dataclass

from src.domain.domain_errors import InvalidPathError


@dataclass(frozen=True, slots=True)
class AbsolutePath:
    segments: tuple[str, ...]

    @classmethod
    def parse(cls, raw_path: str) -> "AbsolutePath":
        if not raw_path:
            raise InvalidPathError("A path is required.")

        if not raw_path.startswith("/"):
            raise InvalidPathError("Paths must be absolute and start with '/'.")

        normalized_segments: list[str] = []

        for segment in raw_path.split("/"):
            if not segment or segment == ".":
                continue

            if segment == "..":
                raise InvalidPathError("Parent directory traversal is not allowed.")

            if "\x00" in segment:
                raise InvalidPathError("Paths cannot contain null bytes.")

            normalized_segments.append(segment)

        return cls(tuple(normalized_segments))

    @property
    def value(self) -> str:
        if not self.segments:
            return "/"

        return "/" + "/".join(self.segments)

    @property
    def is_root(self) -> bool:
        return not self.segments

    @property
    def name(self) -> str:
        if self.is_root:
            return "/"

        return self.segments[-1]

    @property
    def parent(self) -> "AbsolutePath":
        if self.is_root:
            return self

        return AbsolutePath(self.segments[:-1])

    def is_ancestor_of(self, other: "AbsolutePath") -> bool:
        if len(self.segments) >= len(other.segments):
            return False

        return other.segments[: len(self.segments)] == self.segments

    def ensure_directory(self) -> "AbsolutePath":
        if not self.is_root and self.name.endswith(".md"):
            raise InvalidPathError("Directory paths cannot use the '.md' extension.")

        return self

    def ensure_document(self) -> "AbsolutePath":
        if self.is_root:
            raise InvalidPathError("The root path '/' is reserved for directories.")

        if not self.name.endswith(".md"):
            raise InvalidPathError("Document paths must end with '.md'.")

        if self.parent.is_root:
            raise InvalidPathError("The root directory '/' cannot contain documents.")

        return self
