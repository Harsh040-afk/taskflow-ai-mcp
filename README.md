# TaskFlow AI — complete MCP starter

This folder contains the matching frontend, Google Apps Script MCP client, and self-hosted Streamable HTTP MCP server for the TaskFlow AI hackathon MVP.

## What actually uses MCP?

- `Index.html`: user interface only. The Mission workspace's **Test MCP** button calls `testMcpConnection()` in Apps Script and displays the server's tool list.
- `Code.gs`: the MCP client. It calls `initialize`, sends `notifications/initialized`, requests `tools/list`, and calls `tools/call` with `MCP-Protocol-Version: 2025-11-25`. Task add/list/complete/delete and reminder-record operations are routed through this client. Gmail/Calendar read operations remain in Apps Script.
- `server.py`: the self-hosted stateless Streamable HTTP MCP server. It exposes six tools and is protected by a bearer token. It supports JSON-RPC requests over `POST /mcp` and returns `application/json` responses.

## Tools exposed

- `create_task`
- `list_tasks`
- `set_task_done`
- `delete_task`
- `create_reminder`
- `list_reminders`

The mission runner uses rules for the small supported set of requests. It is not yet an LLM planner. Reminder tools save and verify reminder records; they do not send notifications or create Google Calendar events.

## Part 1 — Put this project on GitHub

1. Download and extract the ZIP.
2. Open <https://github.com/new>, create a private repository named `taskflow-ai-mcp`.
3. Upload **all files and subfolders** from this directory to the repository root, then commit them. Make sure `server.py`, `requirements.txt`, `render.yaml`, `Code.gs`, and `Index.html` are present at the top level.
4. Never upload your secret token, private mail data, or `.env` file.

## Part 2 — Deploy the MCP server on Render

1. Open <https://dashboard.render.com/> and sign in.
2. Choose **New + → Web Service** and connect the `taskflow-ai-mcp` GitHub repository.
3. Use these settings:
   - Runtime: **Python 3**
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Instance: **Free** for the demo, if available
4. Generate a token on your Mac in Terminal with:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. In Render's **Environment Variables**, add `MCP_API_TOKEN` with that value. Do not put the token in GitHub or HTML.
6. Deploy. When Render provides a URL such as `https://taskflow-ai-mcp-xxxx.onrender.com`, visit `/health` at that domain. It should return JSON containing `"ok": true`.
7. The exact MCP URL to use is the URL ending in `/mcp`, e.g. `https://taskflow-ai-mcp-xxxx.onrender.com/mcp`.

The server does not allow browser-origin requests to `/mcp`; Apps Script calls it server-to-server with the bearer token. If you intentionally need browser-origin access, configure `ALLOWED_ORIGINS` with exact origins, but do not expose this token to browser code.

## Part 3 — Update your existing Apps Script project

1. Open <https://script.google.com/home> and open your existing TaskFlow AI project.
2. Replace the contents of `Code.gs` with the `Code.gs` file from this package.
3. Replace the contents of `Index.html` with the `Index.html` file from this package.
4. Save both files.
5. Open **Project Settings → Script Properties** and add:
   - `MCP_SERVER_URL` = your exact Render endpoint ending with `/mcp`
   - `MCP_API_TOKEN` = the same token you configured in Render
6. Save the properties.
7. If your project uses an explicit `appsscript.json` manifest, preserve its existing Gmail and Calendar scopes and ensure it includes `https://www.googleapis.com/auth/script.external_request`.
8. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. Approve any requested Google permissions.
9. Restrict the web app to yourself/trusted teammates. Do not publish it openly because it can read Gmail and Calendar through your Google authorization.

## Part 4 — Test the real MCP flow

1. Open your deployed TaskFlow AI web app and navigate to **Mission Control**.
2. Click **Test MCP**. Expected output: `MCP CONNECTION TEST PASSED`, protocol `2025-11-25`, and the six tool names.
3. Enter `Add task: Finish the Alexa+ hackathon submission` and click **Run mission**.
4. The activity log should show `create_task` and a separate `list_tasks` verification call. The task should then appear in the Tasks workspace.
5. Try `Show my tasks` and then complete/delete the task using the Tasks workspace.
6. Try `Add reminder: Record the demo video at 2026-10-23T17:00:00+05:30`. Confirm that it reports a saved reminder record and explicitly says no notification was sent.

## Troubleshooting

- **MCP needs setup:** ensure both Script Properties exist and their spelling is exact.
- **401 Unauthorized:** Render's `MCP_API_TOKEN` must exactly match Apps Script's `MCP_API_TOKEN`.
- **404 or 405:** `MCP_SERVER_URL` must end in `/mcp`, not `/health` or the base URL.
- **503 token missing:** add `MCP_API_TOKEN` in Render's environment settings and redeploy.
- **First request times out:** a free Render instance may be waking up; retry after checking `/health`.
- **Gmail or Calendar fails:** this is separate from MCP. Approve the requested Google scopes and review the Apps Script execution error.

## Limitations and safety notes

- The server's JSON file is local demo storage. Free hosting filesystems can be ephemeral, so task/reminder data may reset after a restart or redeploy. Use persistent storage for production.
- `owner_id` separates records by the Google account email reported by Apps Script, but this MVP uses a shared server token and is intended for a controlled hackathon demo, not as a production multi-tenant service.
- No emails are sent, calendar events are created, or reminders delivered by this MVP.
- The server requires a secret bearer token on `/mcp`, validates any supplied `Origin` header against `ALLOWED_ORIGINS`, limits task titles, and does not expose the token in the frontend.
