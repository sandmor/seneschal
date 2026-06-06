class DomainError(Exception):
    """Base exception for domain and application level failures."""


class InvalidPathError(DomainError):
    """Raised when a requested filesystem path violates domain rules."""


class ResourceNotFoundError(DomainError):
    """Raised when a requested directory or document does not exist."""


class ResourceAlreadyExistsError(DomainError):
    """Raised when creating or moving into an occupied path."""


class DirectoryNotEmptyError(DomainError):
    """Raised when deleting a non-empty directory without recursion."""


class InvalidCredentialsError(DomainError):
    """Raised when a login attempt uses unsupported credentials."""


class AccessDeniedError(DomainError):
    """Raised when a user attempts an action without sufficient access."""


class InvalidCollaborationSeedError(DomainError):
    """Raised when a Yjs room seed cannot be applied."""
