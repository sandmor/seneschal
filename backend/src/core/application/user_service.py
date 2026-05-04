from src.core.domain.models import User

# TODO: dummy data
class UserService:
    def list_users(self) -> list[User]:
        return [
            User(id=1, name="Alice", roles=["admin"]),
            User(id=2, name="Bob", roles=["user"]),
        ]
