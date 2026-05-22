from __future__ import annotations

import asyncio
import logging

from anyio import Lock
from fastapi import WebSocket, WebSocketDisconnect
from pycrdt import Channel
from pycrdt.websocket import WebsocketServer

logger = logging.getLogger("seneschal.websocket")


class FastAPIWebsocket(Channel):
    """Wrapper to make FastAPI's WebSocket compatible with pycrdt-websocket Channel."""

    def __init__(self, websocket: WebSocket, collaboration_id: str) -> None:
        self._websocket = websocket
        self._collaboration_id = collaboration_id
        self._send_lock = Lock()
        super().__init__()

    @property
    def path(self) -> str:
        return self._collaboration_id

    @property
    def room_name(self) -> str:
        return self._collaboration_id

    @property
    def collaboration_id(self) -> str:
        return self._collaboration_id

    @property
    def subprotocol(self) -> str:
        return "y-websocket"

    async def __anext__(self) -> bytes:
        try:
            message = await self.recv()
            return message
        except WebSocketDisconnect:
            raise StopAsyncIteration()

    async def send(self, message: bytes) -> None:
        try:
            async with self._send_lock:
                await self._websocket.send_bytes(message)
        except Exception:
            logger.exception("Failed to send WebSocket message")

    async def recv(self) -> bytes:
        message = await self._websocket.receive_bytes()
        return message


class DocumentCollaborationHandler:
    """Encapsulates WebSocket server state and room lifecycle management."""

    def __init__(self, websocket_server: WebsocketServer) -> None:
        self._websocket_server = websocket_server
        self._initialized_rooms: set[str] = set()
        self._room_init_lock = asyncio.Lock()

    @property
    def websocket_server(self) -> WebsocketServer:
        return self._websocket_server

    async def check_room_status(self, collaboration_id: str) -> dict[str, bool]:
        return {"initialized": collaboration_id in self._initialized_rooms}

    async def initialize_room(self, collaboration_id: str, seed: bytes) -> dict:
        """Create and seed a room before clients can connect."""
        async with self._room_init_lock:
            if collaboration_id in self._initialized_rooms:
                return {"status": "ignored", "message": "Room already initialized"}

            # get_room() automatically creates and registers the Room if it doesn't exist
            room = await self._websocket_server.get_room(collaboration_id)

            room.ydoc.apply_update(seed)

            self._initialized_rooms.add(collaboration_id)
            return {"status": "created"}

    async def handle_document_websocket(
        self,
        websocket: WebSocket,
        collaboration_id: str,
    ) -> None:
        """Handle a WebSocket connection for collaborative document editing."""
        await websocket.accept(subprotocol=_select_subprotocol(websocket))

        # Check if room is initialized
        if collaboration_id not in self._initialized_rooms:
            logger.warning(
                "WebSocket connection rejected for collaboration_id: %s - Room not initialized",
                collaboration_id,
            )
            await websocket.close(code=4001, reason="Room not initialized")
            return

        logger.info("WebSocket connection accepted for collaboration_id: %s", collaboration_id)

        peer = FastAPIWebsocket(websocket, collaboration_id)

        await self._websocket_server.serve(peer)


def _select_subprotocol(websocket: WebSocket) -> str | None:
    requested_subprotocols = {
        protocol.strip()
        for protocol in websocket.headers.get("sec-websocket-protocol", "").split(",")
    }
    return "y-websocket" if "y-websocket" in requested_subprotocols else None
