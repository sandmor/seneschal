from __future__ import annotations

import logging
import logging.handlers
import os
import uuid
from contextvars import ContextVar

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")


class CorrelationIdFilter(logging.Filter):
    """Inject the current correlation ID into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        return True


def configure_logging(
    logger_name: str = "seneschal",
    log_level: str | None = None,
    log_directory: str | None = None,
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5,
) -> logging.Logger:
    """Configure the application logger with stream and rotating file handlers.

    Parameters
    ----------
    logger_name:
        Name of the logger to configure.
    log_level:
        Minimum log level (e.g. ``DEBUG``, ``INFO``). Defaults to the
        ``LOG_LEVEL`` environment variable or ``INFO``.
    log_directory:
        Directory where log files are written. Defaults to the
        ``LOG_DIRECTORY`` environment variable or ``logs``.
    max_bytes:
        Maximum size of a single log file before rotation.
    backup_count:
        Number of rotated log files to retain.
    """
    level = (log_level or os.getenv("LOG_LEVEL", "INFO")).upper()
    directory = log_directory or os.getenv("LOG_DIRECTORY", "logs")

    logger = logging.getLogger(logger_name)
    logger.setLevel(level)

    # Avoid adding duplicate handlers if configure_logging is called multiple times
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(correlation_id)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    correlation_filter = CorrelationIdFilter()

    # Stream handler (stdout) – always present
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(correlation_filter)
    logger.addHandler(stream_handler)

    # Rotating file handler – persistent logs
    os.makedirs(directory, exist_ok=True)
    log_file_path = os.path.join(directory, f"{logger_name}.log")
    file_handler = logging.handlers.RotatingFileHandler(
        log_file_path,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_handler.addFilter(correlation_filter)
    logger.addHandler(file_handler)

    logger.info("Logging configured at level %s (directory: %s)", level, directory)
    return logger


def get_correlation_id() -> str:
    """Return the current correlation ID or ``-`` if none is set."""
    return correlation_id_var.get()


def set_correlation_id(cid: str | None = None) -> str:
    """Set a new correlation ID (UUID4 by default) and return it."""
    new_id = cid or str(uuid.uuid4())
    correlation_id_var.set(new_id)
    return new_id
