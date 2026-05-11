from __future__ import annotations

from anyio import Lock
from fastapi import WebSocket, WebSocketDisconnect
from pycrdt import Channel
from pycrdt.websocket import WebsocketServer


class FastAPIWebsocket(Channel):
    """Wrapper to make FastAPI's WebSocket compatible with pycrdt-websocket Channel."""

    def __init__(self, websocket: WebSocket, path: str) -> None:
        self._websocket = websocket
        self._path = path
        self._send_lock = Lock()

    @property
    def path(self) -> str:
        return self._path

    async def __anext__(self) -> bytes:
        try:
            message = await self.recv()
            return message
        except WebSocketDisconnect:
            raise StopAsyncIteration()
        except Exception:
            raise StopAsyncIteration()

    async def send(self, message: bytes) -> None:
        try:
            async with self._send_lock:
                await self._websocket.send_bytes(message)
        except Exception:
            pass

    async def recv(self) -> bytes:
        return await self._websocket.receive_bytes()


websocket_server = WebsocketServer()


def _select_subprotocol(websocket: WebSocket) -> str | None:
    requested_subprotocols = {
        protocol.strip()
        for protocol in websocket.headers.get("sec-websocket-protocol", "").split(",")
    }
    return "y-websocket" if "y-websocket" in requested_subprotocols else None


async def handle_document_websocket(
    websocket: WebSocket,
    path: str,
) -> None:
    """Handle a WebSocket connection for collaborative document editing via pycrdt."""
    await websocket.accept(subprotocol=_select_subprotocol(websocket))

    peer = FastAPIWebsocket(websocket, path)

    await websocket_server.serve(peer)
