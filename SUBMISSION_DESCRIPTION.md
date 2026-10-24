# TaskFlow AI — Submission Description

## One-line summary

TaskFlow AI is a productivity assistant prototype that turns supported task requests into tool calls and verifies task creation through a separate list operation.

## The problem

Managing everyday work can mean jumping between tasks, email, and calendar views. We wanted to explore a more connected assistant experience: one place to express a task, trigger the relevant operation, and check that it actually happened.

## The solution

TaskFlow AI combines a web dashboard, Google Apps Script, and a Python MCP server. The mission workspace follows **Plan → Act → Verify → Recover**. Its task workflow sends a request to `create_task` and then calls `list_tasks` to check the result.

## Key features

- Create, list, complete, and delete task records through MCP tools.
- Create and list reminder records.
- Read Gmail metadata/snippets and Google Calendar events through Apps Script.
- Test the MCP connection and discover the six available tools.
- Keep the MCP bearer token in server/script configuration rather than frontend code.

## Technology

Python, FastAPI, Uvicorn, Model Context Protocol (MCP) Streamable HTTP, JSON-RPC, Google Apps Script, Gmail and Google Calendar services, HTML, CSS, JavaScript, and Render hosting configuration.

## How it works

1. The browser interface calls Apps Script functions.
2. Apps Script reads Gmail/Calendar data where permissions are granted and sends task/reminder requests to the MCP server.
3. The MCP server validates the request and stores a task or reminder record.
4. For task creation, the workflow reads the task list separately to verify the result.

## Development story

Our team registered with roughly three days remaining and built toward a demonstrable MVP under a very short deadline. The sprint forced us to prioritize the core path, learn and debug the layers between the interface, Google Apps Script, the MCP protocol, and cloud deployment, and document important limitations rather than pretending every planned feature was finished.

## Current limitations

- The mission runner is rule-based for a small supported set of requests; it is not a general LLM planner.
- Reminder records can be saved and listed, but notifications are not delivered and no Google Calendar event is created.
- Gmail/Calendar functionality is read-only.
- Local JSON storage may be ephemeral on the selected host.
- A successful local code review does not prove a live deployment is connected. Run `docs/TESTING.md` and use only observed results when describing the deployed status.

## What is next

Improve deployment diagnostics, add integration tests, migrate to persistent storage, expand the supported mission parser carefully, and design an explicit reminder-delivery mechanism with appropriate user permissions.

**TaskFlow AI — Less task juggling. More follow-through.**
