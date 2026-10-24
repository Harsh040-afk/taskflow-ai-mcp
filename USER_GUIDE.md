# TaskFlow AI — User Guide

## 1. Open the application

Open the deployed Google Apps Script web-app URL ending in `/exec`. Sign in with the Google account authorized for the app. If the app has not been deployed yet, follow the deployment steps in the root README.

## 2. Check MCP connectivity

1. Open **Mission Control**.
2. Click **Test MCP**.
3. Confirm the result shows protocol `2025-11-25` and the six expected tools.

If the connection fails, do not continue treating task operations as verified. Check the service `/health` URL, the two Script Properties, and the Render logs.

## 3. Create and verify a task

1. Enter: `Add task: Finish the hackathon submission`.
2. Click **Run mission**.
3. Read the activity log.
4. Confirm that `create_task` ran and a separate `list_tasks` call verified that the task exists.
5. Confirm the task appears in the task workspace.

## 4. View, complete, or delete a task

Use the Tasks workspace to view existing records, mark a task complete/incomplete, or delete it. Refresh the list after a change and confirm that the displayed state matches the action.

## 5. Create a reminder record

Use a supported request such as `Add reminder: Record the demo video at 2026-10-25T17:00:00+05:30`, choosing a future date/time appropriate to your use. Confirm that the result is listed as a saved reminder record. **This prototype does not send notifications or create Calendar events.**

## 6. Gmail and Calendar views

Use the Gmail and Calendar areas of the dashboard after granting the requested Google permissions. Gmail content is represented as a date-filtered metadata/snippet digest, not a full AI interpretation. Calendar integration reads events; the prototype does not create calendar events.

## Troubleshooting

- **MCP needs setup:** check Script Properties in Apps Script.
- **401 Unauthorized:** compare the Render and Apps Script tokens carefully; do not share them in screenshots or chat.
- **404/405:** the `MCP_SERVER_URL` value must end in `/mcp`.
- **Server not responding:** check Render Events and Logs; confirm `/health` returns `ok: true`.
- **Google data unavailable:** authorize the right Google account and inspect Apps Script Executions.
- **Task disappears after redeploy:** the demo store may be ephemeral. Persistent storage is a known limitation.

## Privacy reminder

Use only a trusted account and test data. Restrict access to the deployed web app; it may read Gmail and Calendar using your Google authorization. Never publish service tokens or private mail/calendar content.
