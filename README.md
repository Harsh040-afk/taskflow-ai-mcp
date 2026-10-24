# TaskFlow AI

**Less task juggling. More follow-through.**

TaskFlow AI is a hackathon MVP exploring a unified productivity workflow across task management, Gmail context, and Google Calendar. Its mission workspace follows **Plan → Act → Verify → Recover**: a supported request triggers a tool call, and task creation is followed by a separate task-list check.

> **Prototype status:** This project is an MVP, not a production-ready autonomous agent. Its mission runner supports a small set of rule-based requests rather than free-form LLM planning. Reminder records can be created and listed, but they do not deliver notifications or create Google Calendar events. Before presenting the hosted demo, configure the Render and Apps Script secrets and run the checks in [`docs/TESTING.md`](docs/TESTING.md).

## What is in this repository?

- `Index.html` — TaskFlow AI web interface.
- `Code.gs` — Google Apps Script backend/client. It communicates with the MCP server for task and reminder tools; Gmail and Calendar reads are handled in Apps Script.
- `server.py` — Python/FastAPI stateless MCP server over Streamable HTTP.
- `requirements.txt` — Python dependencies.
- `render.yaml` — Render service configuration.
- `docs/` — architecture, user/testing guide, product feedback, submission description, and friction log.
- `LICENSE` — MIT open-source license.

## MCP implementation

The server implements MCP protocol version `2025-11-25` and accepts JSON-RPC requests at `POST /mcp`. The Apps Script client performs initialization, sends `notifications/initialized`, lists tools, and makes tool calls using the `MCP-Protocol-Version` header.

The six tools are:

- `create_task`
- `list_tasks`
- `set_task_done`
- `delete_task`
- `create_reminder`
- `list_reminders`

The server uses a bearer token for `/mcp`. Keep that token in environment/script properties only; never put it in `Index.html`, commit it to Git, or paste it into public issue trackers.

## Requirements

- A GitHub account for source control.
- A Render account (or another host capable of running the Python server) if using the hosted MCP endpoint.
- A Google account with permission to create/deploy Apps Script projects.
- A modern browser.

## Deploy the MCP server on Render

1. If you already have a public GitHub repository, upload/replace the project files from this package in that repository. Otherwise, create a repository and upload the extracted files. Keep `LICENSE` at the repository root so GitHub can detect and display the license.
2. In [Render](https://dashboard.render.com/), choose **New + → Web Service** and connect the repository.
3. Use these settings if Render does not automatically detect `render.yaml`:
   - Runtime: **Python 3**
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Create a strong token locally:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. Set `MCP_API_TOKEN` in the Render service's environment variables to the generated token. Do not put the value in the repository.
6. Deploy. Test `https://YOUR-SERVICE.onrender.com/health`; expect JSON containing `"ok": true`.
7. Use `https://YOUR-SERVICE.onrender.com/mcp` as the MCP endpoint, not `/health` or the site root.

The service rejects browser-origin requests to `/mcp` by default. Apps Script should call it server-to-server with the bearer token. Do not expose the bearer token to browser JavaScript.

## Connect Google Apps Script

1. Open [Google Apps Script](https://script.google.com/home) and open the TaskFlow AI project.
2. Replace the `Code.gs` contents with this repository's `Code.gs`, and replace the `Index.html` contents with this repository's `Index.html`.
3. Open **Project Settings → Script Properties** and add/update the following properties:
   - `MCP_SERVER_URL` — the full HTTPS URL ending in `/mcp`.
   - `MCP_API_TOKEN` — exactly the same token configured in Render.
4. Save the properties. If this project uses an explicit `appsscript.json`, preserve needed Gmail and Calendar scopes and include `https://www.googleapis.com/auth/script.external_request`.
5. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. Review and approve requested permissions.
6. Restrict the Apps Script web app to yourself or trusted users. It can read Gmail and Calendar using the accessing user's Google authorization; do not publish it with unrestricted access.
7. Open the deployed web-app URL ending in `/exec`.

## Test the main flow

1. Navigate to **Mission Control** and click **Test MCP**. The expected result is protocol version `2025-11-25` and all six tool names.
2. Enter `Add task: Finish the hackathon submission` and click **Run mission**.
3. Inspect the activity log. The expected sequence includes `create_task` followed by `list_tasks` verification, with the new task appearing in the task list.
4. Try showing, completing, and deleting a task.
5. Create a reminder and confirm that the app describes it as a saved record. Do not claim that a notification was delivered: notifications are not implemented in this MVP.
6. Record the actual date, environment, result, and any error in [`docs/TESTING.md`](docs/TESTING.md). A listed test case is not evidence that a test has passed.

## Troubleshooting

| Symptom | Check |
|---|---|
| `MCP needs setup` | Both Script Properties exist and are spelled correctly. |
| `401 Unauthorized` | `MCP_API_TOKEN` matches exactly in Render and Apps Script. |
| `404` or `405` | `MCP_SERVER_URL` ends in `/mcp`. |
| `503 token missing` | Set `MCP_API_TOKEN` in Render and redeploy. |
| `/health` does not return `ok: true` | Review Render deployment events and logs. |
| First request times out | A free host may be waking up; retry `/health`, then Test MCP. |
| Gmail/Calendar reads fail | Check Google authorization, Apps Script scopes, and execution logs. |

## Security and known limitations

- The server stores task/reminder records in a local JSON file. Some free-host filesystems are ephemeral, so data may be lost after restarts or redeploys. Production use needs persistent storage.
- The server uses a shared bearer token. `owner_id` separates records within the demo, but this is not a hardened multi-tenant production architecture.
- Gmail/Calendar functionality is read-only in this MVP. The app does not send email, create calendar events, or deliver reminders.
- The mission runner is rule-based for a small set of supported requests; it is not a general LLM planner.
- Do not commit real secrets, personal email/calendar data, `.env` files, or production credentials.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [User guide](docs/USER_GUIDE.md)
- [Testing checklist](docs/TESTING.md)
- [Product feedback](docs/PRODUCT_FEEDBACK.md)
- [Submission description](docs/SUBMISSION_DESCRIPTION.md)
- [Friction log](docs/FRICTION_LOG.md)

## License

Released under the MIT License. See [`LICENSE`](LICENSE).
