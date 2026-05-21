from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

ALGORITHM = "pbkdf2_sha256"
DEFAULT_ITERATIONS = 100_000
SALT_BYTES = 16


class Pbkdf2PasswordHasher:
    def hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(SALT_BYTES)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            DEFAULT_ITERATIONS,
        )
        return "$".join(
            [
                ALGORITHM,
                str(DEFAULT_ITERATIONS),
                base64.b64encode(salt).decode("ascii"),
                base64.b64encode(digest).decode("ascii"),
            ]
        )

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            algorithm, iterations_raw, salt_raw, digest_raw = password_hash.split("$", maxsplit=3)
        except ValueError:
            return False

        if algorithm != ALGORITHM:
            return False

        try:
            iterations = int(iterations_raw)
            salt = base64.b64decode(salt_raw.encode("ascii"))
            expected_digest = base64.b64decode(digest_raw.encode("ascii"))
        except (TypeError, ValueError):
            return False

        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(actual_digest, expected_digest)
