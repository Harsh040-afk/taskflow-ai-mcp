# TaskFlow AI — Testing Checklist

This document is a test plan. Mark a case **PASS** only after running it in the target environment and observing the expected result. Do not treat expected results as completed test evidence.

## Environment details to record

- Test date/time and timezone:
- Git commit or repository revision:
- Render service URL (domain only; never include tokens):
- Apps Script deployment version:
- Tester:

## Test cases

| ID | Test | Steps | Expected result | Actual result / status |
|---|---|---|---|---|
| T01 | Health check | Open the Render `/health` endpoint. | JSON response includes `"ok": true`. | Pending manual run |
| T02 | MCP handshake | In Mission Control, click **Test MCP**. | Protocol `2025-11-25` and six tools are listed. | Pending manual run |
| T03 | Create task | Run `Add task: Test task`. | Task is created and appears in task list. | Pending manual run |
| T04 | Verify task | Review activity log after T03. | Separate `create_task` and `list_tasks` calls are visible; task exists in returned list. | Pending manual run |
| T05 | List tasks | Run a supported “show my tasks” request or open Tasks. | Existing tasks are displayed. | Pending manual run |
| T06 | Complete task | Mark a test task done. | Task state changes to complete. | Pending manual run |
| T07 | Delete task | Delete a disposable test task. | Task is removed from the current list. | Pending manual run |
| T08 | Reminder record | Add a reminder and list reminders. | Record can be saved/listed; UI does not claim a notification was delivered. | Pending manual run |
| T09 | Missing token | In a controlled test environment only, temporarily remove/incorrectly configure token. Restore it after test. | Clear authorization/configuration failure; no false success. | Optional; pending manual run |
| T10 | Gmail access | Open Gmail view after granting required scope. | Date-filtered mail metadata/snippets load, or a clear permission error appears. | Pending manual run |
| T11 | Calendar access | Open Calendar view after granting required scope. | Current day's event list loads, or a clear permission error appears. | Pending manual run |

## Test summary

- Total executed:
- Passed:
- Failed:
- Blocked:
- Known issues:

## Evidence to capture

For each executed case, record the actual result and, where safe, capture a screenshot that does not expose email addresses, private message content, tokens, or other personal information. Store detailed errors from Render and Apps Script Executions without publishing secrets.
