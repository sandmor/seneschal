from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.infrastructure.logging_config import correlation_id_var, set_correlation_id


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware that assigns a correlation ID to every incoming request.

    The ID is read from the ``X-Request-ID`` header when present, otherwise a
    new UUID4 is generated. The value is stored in a ``contextvars.ContextVar``
    so that every log record emitted during the request lifecycle includes it.
    The ID is also echoed back in the response header ``X-Request-ID``.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        header_cid = request.headers.get("X-Request-ID")
        cid = set_correlation_id(header_cid)

        try:
            response = await call_next(request)
        finally:
            correlation_id_var.set("-")

        response.headers["X-Request-ID"] = cid
        return response
