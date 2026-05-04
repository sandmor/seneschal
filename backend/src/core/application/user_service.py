from src.core.domain.models import User


class UserService:
    def list_users(self) -> list[User]:
        raise NotImplementedError("User listing is not implemented yet")
