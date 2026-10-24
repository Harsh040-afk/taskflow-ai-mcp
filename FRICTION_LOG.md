# TaskFlow AI — Friction Log

Entries below describe issues and constraints encountered or reported during development. For any issue where the root cause was not confirmed, the log says so. Update entries with exact logs and observed outcomes after retesting.

## F01 — Very short build window

- **Task attempted:** Build and submit TaskFlow AI for the hackathon.
- **Steps:** Registered when approximately three days remained; selected a narrow MVP scope; developed the frontend, Apps Script client, and Python MCP server; prepared deployment and submission materials.
- **Expected:** Enough time to build, integrate, test, and polish each component.
- **Actual:** Time pressure required parallel focus on implementation, integration, documentation, and last-minute submission. End-to-end validation and polish were harder to fit in.
- **Severity:** High.
- **Workaround:** Prioritized core task operations and documented known limitations rather than claiming unimplemented features.
- **Actionable suggestion:** Provide a short official starter repo showing an MCP server, protocol handshake, deployment, and one verified tool flow.

## F02 — Cross-service MCP configuration

- **Task attempted:** Connect the Apps Script client to the hosted Python MCP server.
- **Steps:** Configure the Render endpoint and bearer token; set `MCP_SERVER_URL` and `MCP_API_TOKEN` in Apps Script; deploy a new Apps Script version; run Test MCP.
- **Expected:** The client initializes MCP, discovers tools, and calls the task tools.
- **Actual:** The integration depends on several independent settings agreeing: endpoint ending in `/mcp`, token equality, protocol version, server availability, and deployment version. A later connection loss was reported, but the root cause was not confirmed in this log.
- **Severity:** High for live-demo reliability.
- **Workaround:** Check `/health`, compare Script Properties and Render environment variables, redeploy, then run Test MCP before attempting missions.
- **Actionable suggestion:** Add a single diagnostic that checks server reachability, token authorization, negotiated protocol, tool listing, and the active Apps Script version without exposing secrets.

## F03 — Hosting and storage assumptions

- **Task attempted:** Host the MCP server on an accessible free/demo service.
- **Expected:** Endpoint remains reachable and task/reminder records persist across runs.
- **Actual:** Free hosting may sleep or use ephemeral filesystems, so cold starts or data resets are possible. This is a known deployment risk, not proof that a specific reset occurred.
- **Severity:** Medium.
- **Workaround:** Check the health endpoint before demos; use disposable test data; do not promise persistence across redeploys.
- **Actionable suggestion:** Add persistent storage and a deployment smoke test before using the app for real personal data.

## F04 — Feature boundaries and user expectations

- **Task attempted:** Present task and reminder workflows as one productivity experience.
- **Expected:** A reminder might be understood by users as a notification that will be delivered.
- **Actual:** This prototype only saves and lists reminder records; it does not send notifications or create Calendar events. The rule-based mission runner also supports only a limited request set.
- **Severity:** Medium.
- **Workaround:** Label reminders as records and state the limitations in the UI and README.
- **Actionable suggestion:** Use separate statuses for “saved”, “scheduled”, and “delivered”; add a real notification backend only after designing permissions and retry handling.

## F05 — Demo video generation credits

- **Task attempted:** Generate a narrated video through the chosen AI video tool for the project demo.
- **Expected:** Generate a voiceover and assemble a final video within the free allowance.
- **Actual:** The generation tool returned an out-of-credits error before producing the narration. A finished AI-generated video was therefore not produced through that workflow.
- **Severity:** Medium for presentation polish; not a runtime code defect.
- **Workaround:** Consider a free editor/template workflow or a screen recording with locally recorded narration; ensure the video primarily demonstrates the actual project.
- **Actionable suggestion:** Verify free-tier quotas before committing the final demo workflow and keep a manual screen-recording fallback.
