"""TaskFlow AI's minimal stateless MCP server over Streamable HTTP.

Implements MCP JSON-RPC methods: initialize, notifications/initialized,
 tools/list, and tools/call. No browser-facing CORS is enabled. Calls to /mcp
require a bearer token. Data is demo-grade local JSON storage; see README.
"""
from __future__ import annotations

import json
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

PROTOCOL_VERSION = "2025-11-25"
SERVER_NAME = "taskflow-ai-mcp"
SERVER_VERSION = "1.0.0"
TOKEN = os.environ.get("MCP_API_TOKEN", "").strip()
ALLOWED_ORIGINS = {
    item.strip().rstrip("/") for item in os.environ.get("ALLOWED_ORIGINS", "").split(",") if item.strip()
}
DATA_FILE = Path(os.environ.get("TASKFLOW_DATA_FILE", "/tmp/taskflow_ai_data.json"))
DATA_LOCK = threading.Lock()

app = FastAPI(title="TaskFlow AI MCP Server", docs_url=None, redoc_url=None)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _load_store() -> dict[str, Any]:
    try:
        value = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            value.setdefault("tasks", {})
            value.setdefault("reminders", {})
            return value
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return {"tasks": {}, "reminders": {}}


def _save_store(store: dict[str, Any]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(DATA_FILE.suffix + ".tmp")
    tmp.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(DATA_FILE)


def _owner(args: dict[str, Any]) -> str:
    owner_id = str(args.get("owner_id", "")).strip()
    if not owner_id:
        raise ValueError("owner_id is required")
    if len(owner_id) > 200:
        raise ValueError("owner_id is too long")
    return owner_id


def _title(args: dict[str, Any], field: str = "title") -> str:
    title = str(args.get(field, "")).strip()
    if not title:
        raise ValueError(f"{field} is required")
    if len(title) > 180:
        raise ValueError(f"{field} must be 180 characters or fewer")
    return title


def create_task(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    title = _title(args)
    with DATA_LOCK:
        store = _load_store()
        tasks = store["tasks"].setdefault(owner, [])
        task = {"id": str(uuid.uuid4()), "title": title, "done": False, "createdAt": _now()}
        tasks.insert(0, task)
        del tasks[100:]
        _save_store(store)
    return {"task": task, "count": len(tasks)}


def list_tasks(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    with DATA_LOCK:
        store = _load_store()
        tasks = list(store["tasks"].get(owner, []))
    return {"tasks": tasks, "count": len(tasks)}


def set_task_done(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    task_id = str(args.get("task_id", "")).strip()
    if not task_id:
        raise ValueError("task_id is required")
    if not isinstance(args.get("done"), bool):
        raise ValueError("done must be a boolean")
    with DATA_LOCK:
        store = _load_store()
        tasks = store["tasks"].setdefault(owner, [])
        task = next((t for t in tasks if t["id"] == task_id), None)
        if task is None:
            raise ValueError("Task not found")
        task["done"] = args["done"]
        _save_store(store)
        updated = dict(task)
    return {"task": updated}


def delete_task(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    task_id = str(args.get("task_id", "")).strip()
    if not task_id:
        raise ValueError("task_id is required")
    with DATA_LOCK:
        store = _load_store()
        tasks = store["tasks"].setdefault(owner, [])
        before = len(tasks)
        store["tasks"][owner] = [t for t in tasks if t["id"] != task_id]
        if len(store["tasks"][owner]) == before:
            raise ValueError("Task not found")
        _save_store(store)
        count = len(store["tasks"][owner])
    return {"deleted": True, "task_id": task_id, "count": count}


def create_reminder(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    title = _title(args)
    due_at = str(args.get("due_at", "")).strip()
    if not due_at:
        raise ValueError("due_at is required and must include a timezone offset")
    try:
        parsed = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("due_at must be an ISO-8601 date/time, e.g. 2026-10-23T17:00:00+05:30") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("due_at must include a timezone offset, e.g. +05:30")
    reminder = {"id": str(uuid.uuid4()), "title": title, "dueAt": parsed.isoformat(), "createdAt": _now()}
    with DATA_LOCK:
        store = _load_store()
        items = store["reminders"].setdefault(owner, [])
        items.insert(0, reminder)
        del items[100:]
        _save_store(store)
        count = len(items)
    return {"reminder": reminder, "count": count, "note": "Saved reminder record only; no notification is sent."}


def list_reminders(args: dict[str, Any]) -> dict[str, Any]:
    owner = _owner(args)
    with DATA_LOCK:
        store = _load_store()
        items = list(store["reminders"].get(owner, []))
    return {"reminders": items, "count": len(items)}


TOOLS: list[dict[str, Any]] = [
    {"name": "create_task", "description": "Create a task for the current TaskFlow user.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string", "description": "Stable user identifier supplied by the app"}, "title": {"type": "string", "maxLength": 180}}, "required": ["owner_id", "title"], "additionalProperties": False}},
    {"name": "list_tasks", "description": "List tasks for the current TaskFlow user, newest first.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string"}}, "required": ["owner_id"], "additionalProperties": False}},
    {"name": "set_task_done", "description": "Set a task's completion status.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string"}, "task_id": {"type": "string"}, "done": {"type": "boolean"}}, "required": ["owner_id", "task_id", "done"], "additionalProperties": False}},
    {"name": "delete_task", "description": "Delete a task by ID.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string"}, "task_id": {"type": "string"}}, "required": ["owner_id", "task_id"], "additionalProperties": False}},
    {"name": "create_reminder", "description": "Save a reminder record with an ISO-8601 time and explicit timezone. This does not send a notification.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string"}, "title": {"type": "string", "maxLength": 180}, "due_at": {"type": "string", "description": "ISO-8601 date/time including timezone offset"}}, "required": ["owner_id", "title", "due_at"], "additionalProperties": False}},
    {"name": "list_reminders", "description": "List saved reminder records for the current TaskFlow user.", "inputSchema": {"type": "object", "properties": {"owner_id": {"type": "string"}}, "required": ["owner_id"], "additionalProperties": False}},
]

TOOL_HANDLERS = {
    "create_task": create_task,
    "list_tasks": list_tasks,
    "set_task_done": set_task_done,
    "delete_task": delete_task,
    "create_reminder": create_reminder,
    "list_reminders": list_reminders,
}


@app.middleware("http")
async def protect_mcp(request: Request, call_next):
    if request.url.path == "/mcp":
        origin = request.headers.get("origin")
        if origin:
            normalized = origin.rstrip("/")
            if not ALLOWED_ORIGINS or normalized not in ALLOWED_ORIGINS:
                return JSONResponse({"error": "Origin not allowed"}, status_code=403)
        if not TOKEN:
            return JSONResponse({"error": "Server is not configured: MCP_API_TOKEN is missing"}, status_code=503)
        supplied = request.headers.get("authorization", "")
        if not supplied.lower().startswith("bearer ") or not secrets.compare_digest(supplied[7:].strip(), TOKEN):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)


def _rpc_error(request_id: Any, code: int, message: str) -> JSONResponse:
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}, headers={"MCP-Protocol-Version": PROTOCOL_VERSION})


def _rpc_result(request_id: Any, result: dict[str, Any]) -> JSONResponse:
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "result": result}, headers={"MCP-Protocol-Version": PROTOCOL_VERSION})


@app.get("/health")
async def health():
    return {"ok": True, "service": SERVER_NAME, "protocolVersion": PROTOCOL_VERSION}


@app.post("/mcp")
async def mcp_post(request: Request):
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        return JSONResponse({"error": "Content-Type must be application/json"}, status_code=415)
    accept = request.headers.get("accept", "")
    if "application/json" not in accept or "text/event-stream" not in accept:
        return JSONResponse({"error": "Accept must include application/json and text/event-stream"}, status_code=406)
    try:
        message = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        return JSONResponse({"error": "Expected one JSON-RPC 2.0 message"}, status_code=400)

    method = message["method"]
    request_id = message.get("id")
    has_id = "id" in message
    # This stateless endpoint negotiates protocol version during initialize;
    # subsequent client requests must carry the selected version header.
    if method != "initialize" and not method.startswith("notifications/"):
        supplied_version = request.headers.get("mcp-protocol-version")
        if supplied_version != PROTOCOL_VERSION:
            return JSONResponse({"error": "MCP-Protocol-Version must be " + PROTOCOL_VERSION}, status_code=400)
    if method in {"notifications/initialized", "notifications/cancelled"} and not has_id:
        return Response(status_code=202)
    if method.startswith("notifications/") and not has_id:
        return Response(status_code=202)
    if not has_id:
        return Response(status_code=202)

    if method == "initialize":
        params = message.get("params") or {}
        requested_version = params.get("protocolVersion", PROTOCOL_VERSION)
        if requested_version != PROTOCOL_VERSION:
            return _rpc_error(request_id, -32602, "Unsupported protocol version. Use " + PROTOCOL_VERSION)
        return _rpc_result(request_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "instructions": "TaskFlow task and reminder tools. Reminder records do not send notifications."
        })
    if method == "ping":
        return _rpc_result(request_id, {})
    if method == "tools/list":
        return _rpc_result(request_id, {"tools": TOOLS})
    if method == "tools/call":
        params = message.get("params") or {}
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            return _rpc_error(request_id, -32602, "Tool arguments must be a JSON object")
        handler = TOOL_HANDLERS.get(tool_name)
        if handler is None:
            return _rpc_error(request_id, -32602, "Unknown tool: " + str(tool_name))
        try:
            result = handler(arguments)
            return _rpc_result(request_id, {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}], "isError": False})
        except (ValueError, TypeError) as exc:
            return _rpc_result(request_id, {"content": [{"type": "text", "text": str(exc)}], "isError": True})
        except Exception:
            return _rpc_result(request_id, {"content": [{"type": "text", "text": "Internal tool error"}], "isError": True})
    return _rpc_error(request_id, -32601, "Method not found: " + method)


@app.get("/mcp")
async def mcp_get_not_supported():
    # This server is stateless and sends a single JSON response to client POSTs.
    return Response(status_code=405, headers={"Allow": "POST"})


@app.delete("/mcp")
async def mcp_delete_not_supported():
    return Response(status_code=405, headers={"Allow": "POST"})
