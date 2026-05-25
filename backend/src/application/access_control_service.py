from __future__ import annotations

from dataclasses import dataclass

from src.application.access_control_repository import AccessControlRepository
from src.domain.access_control import (
    AccessLevel,
    AccessOverride,
    EffectiveAccessPolicy,
    is_access_at_least,
)
from src.domain.auth_entities import AuthenticatedPrincipal
from src.domain.domain_errors import AccessDeniedError
from src.domain.file_system_entities import DirectoryDetail, DirectoryEntry, NodeKind
from src.domain.paths import AbsolutePath


@dataclass(slots=True)
class AccessControlService:
    repository: AccessControlRepository
    default_access: AccessLevel = AccessLevel.READ

    def list_overrides(self) -> list[AccessOverride]:
        return self.repository.list_overrides()

    def set_override(
        self,
        *,
        path: AbsolutePath,
        kind: NodeKind,
        default_access: AccessLevel | None,
        role_overrides: dict[str, AccessLevel],
    ) -> AccessOverride:
        return self.repository.upsert_override(
            path=path,
            kind=kind,
            default_access=default_access,
            role_overrides=role_overrides,
        )

    def delete_override(self, *, path: AbsolutePath, kind: NodeKind) -> bool:
        return self.repository.delete_override(path, kind)

    def get_effective_policy(self, path: AbsolutePath, kind: NodeKind) -> EffectiveAccessPolicy:
        policy = EffectiveAccessPolicy(default_access=self.default_access, role_overrides={})
        directory_chain = self._directory_chain(path, include_self=kind == NodeKind.DIRECTORY)
        directory_overrides = self.repository.list_overrides_for_paths(
            directory_chain, kind=NodeKind.DIRECTORY
        )
        overrides_by_path = {override.path.value: override for override in directory_overrides}
        for directory_path in directory_chain:
            policy = policy.apply_override(overrides_by_path.get(directory_path.value))

        if kind == NodeKind.DOCUMENT:
            doc_override = self.repository.get_override(path, NodeKind.DOCUMENT)
            policy = policy.apply_override(doc_override)

        return policy

    def get_effective_access(
        self, principal: AuthenticatedPrincipal, path: AbsolutePath, kind: NodeKind
    ) -> AccessLevel:
        if principal.is_superadmin:
            return AccessLevel.WRITE
        policy = self.get_effective_policy(path, kind)
        return policy.access_for_roles(principal.roles)

    def ensure_access(
        self,
        *,
        principal: AuthenticatedPrincipal,
        path: AbsolutePath,
        kind: NodeKind,
        required: AccessLevel,
    ) -> None:
        access = self.get_effective_access(principal, path, kind)
        if not is_access_at_least(access, required):
            raise AccessDeniedError("Access denied.")

    def filter_directory(
        self, detail: DirectoryDetail, principal: AuthenticatedPrincipal
    ) -> DirectoryDetail:
        if principal.is_superadmin:
            return detail

        base_policy = self.get_effective_policy(detail.directory.path, NodeKind.DIRECTORY)
        child_paths = [child.path for child in detail.children]
        overrides = self.repository.list_overrides_for_paths(child_paths)
        overrides_by_key = {
            (override.path.value, override.kind): override for override in overrides
        }

        filtered_children = []
        child_directories = 0
        child_documents = 0

        for child in detail.children:
            override = overrides_by_key.get((child.path.value, child.kind))
            policy = base_policy.apply_override(override)
            access = policy.access_for_roles(principal.roles)
            if access == AccessLevel.NONE:
                continue

            filtered_children.append(child)
            if child.kind == NodeKind.DIRECTORY:
                child_directories += 1
            else:
                child_documents += 1

        directory = DirectoryEntry(
            path=detail.directory.path,
            child_directories_count=child_directories,
            child_documents_count=child_documents,
        )
        return DirectoryDetail(directory=directory, children=filtered_children)

    @staticmethod
    def _directory_chain(path: AbsolutePath, *, include_self: bool) -> list[AbsolutePath]:
        segments = path.segments
        if not include_self:
            segments = segments[:-1]
        chain = [AbsolutePath(())]
        current: list[str] = []
        for segment in segments:
            current.append(segment)
            chain.append(AbsolutePath(tuple(current)))
        return chain
