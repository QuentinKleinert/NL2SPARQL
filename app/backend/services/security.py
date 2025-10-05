from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Depends, HTTPException, Request, status

from app.backend.config import get_settings

_HEADER_NAME = "x-api-key"


class RateLimiter:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self.limit: int = 120
        self.window_seconds: int = 60
        self.burst_allowance: int = 30

    async def hit(self, identifier: str) -> None:
        now = time.time()
        async with self._lock:
            bucket = self._hits[identifier]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            limit = self.limit + self.burst_allowance
            if len(bucket) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Bitte kurz warten.",
                )
            bucket.append(now)

    async def reset(self) -> None:  # pragma: no cover - used in tests
        async with self._lock:
            self._hits.clear()

    def configure(self, per_minute: int, burst: int) -> None:
        self.limit = max(1, per_minute)
        self.window_seconds = 60
        self.burst_allowance = max(0, burst)


_rate_limiter = RateLimiter()


def refresh_rate_limiter() -> None:
    settings = get_settings()
    _rate_limiter.configure(
        per_minute=settings.rate_limit_per_minute,
        burst=settings.rate_limit_burst,
    )


def require_api_key(request: Request) -> None:
    settings = get_settings()
    incoming = request.headers.get(_HEADER_NAME)
    if not incoming:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            incoming = auth_header.split(" ", 1)[1]
    if not incoming:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key missing.",
        )
    if incoming != settings.api_auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key invalid.",
        )


async def rate_limit_dependency(
    request: Request, _: None = Depends(require_api_key)
) -> None:
    identifier = request.headers.get(_HEADER_NAME) or (request.client.host if request.client else "unknown")
    await _rate_limiter.hit(identifier)


async def reset_rate_limiter_for_tests() -> None:
    await _rate_limiter.reset()


__all__ = [
    "require_api_key",
    "rate_limit_dependency",
    "refresh_rate_limiter",
    "reset_rate_limiter_for_tests",
]
