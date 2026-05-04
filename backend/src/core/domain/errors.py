class InvalidCredentialsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class PermissionDeniedError(Exception):
    pass


class RoleNotFoundError(Exception):
    pass


class TokenExpiredError(Exception):
    pass
