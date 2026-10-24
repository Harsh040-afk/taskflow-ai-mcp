# TaskFlow AI — Product Feedback

This feedback reflects the tools and services used to build this MVP. It describes our team's experience, not a claim that every platform behaves the same for every developer.

## Tools, APIs, and what we used them for

| Tool / service | Use in TaskFlow AI | What worked well | What could improve | Would we use it again? |
|---|---|---|---|---|
| Python | Implementing the MCP server logic. | Fast to iterate on validation, JSON-RPC handling, and tool definitions. | A more complete automated test suite and persistent storage would help harden the prototype. | Yes. |
| FastAPI + Uvicorn | HTTP server and application runtime. | A straightforward way to expose health and MCP endpoints. | Clear deployment diagnostics and repeatable staging tests are valuable when environment configuration changes. | Yes. |
| Model Context Protocol (MCP), Streamable HTTP | Standardized tool discovery/calling between Apps Script and the Python server using protocol version `2025-11-25`. | A defined initialize/list/call flow makes tool capabilities explicit and inspectable. | First-time integration requires careful handling of protocol version, headers, endpoint path, and errors. More beginner-oriented end-to-end examples would be helpful. | Yes. |
| Google Apps Script | Web-app backend, MCP client, and access to Gmail/Calendar APIs. | It allows a lightweight interface to call Google services with user-granted authorization. | Deployment versions, Script Properties, OAuth scopes, and multi-account behavior can be easy to misconfigure under time pressure. | Yes, for Google-centered prototypes. |
| Gmail and Google Calendar services | Read-only Gmail metadata/snippet summaries and Calendar event reads. | Useful context is available within the Google ecosystem once permissions are granted. | Permission errors and account selection need clear UX. The current MVP intentionally does not send email or create events. | Yes, with clearer permission/error flows. |
| Render | Hosting the Python MCP server. | A simple route from repository to a hosted HTTP service. | Cold starts on free instances and environment-token/redeploy coordination can complicate live demos. Persistent storage needs separate consideration. | Yes for demos; production needs a reviewed hosting/storage plan. |
| HTML, CSS, JavaScript | Dashboard and mission interface. | Enables a quick, accessible web UI without an additional frontend build stack. | UI success states should always reflect server-confirmed outcomes and handle unavailable services clearly. | Yes. |

## Onboarding experience

We registered for the hackathon with about three days remaining, so onboarding was compressed. The main learning curve was not writing a single function; it was understanding and connecting multiple layers: Google Apps Script, protocol initialization, Streamable HTTP, endpoint paths, environment variables, bearer-token configuration, Google permissions, and deployment versions. A minimal end-to-end sample with a health check, tool listing, one verified tool call, and a deployment checklist would make the first successful run easier to reach.

## What worked well

- The MCP tool surface is explicit: six named tools with clear responsibilities.
- The client can discover tools and call them through a defined protocol flow.
- The task workflow is designed to verify a mutation using a separate read call.
- Separating Google data reads from task/reminder operations makes the architecture easier to reason about.

## What needs work in our implementation

- Add automated integration tests for initialize, tools/list, create/list, complete, delete, and reminder operations.
- Improve structured diagnostic output for endpoint, authorization, and protocol-version failures.
- Replace local JSON demo storage with persistent storage before production use.
- Replace rule-based request matching with a carefully constrained planner if broader natural-language support is needed.
- Add user-visible states for reminder records versus actual delivered notifications.

## Would we build with these tools again?

Yes. Python/FastAPI and MCP were practical for a compact tool server; Apps Script was useful for Google integration; Render made hosting accessible for a prototype. We would use them again while budgeting time for deployment, secrets, permission handling, persistent storage, and end-to-end tests from the start.

## Scope note

The current implementation does not use AWS services, an Alexa SDK, or an LLM planning runtime. It targets the Alexa+ track with a self-hosted MCP server and a web-based productivity experience. Do not describe AWS products or an Alexa API as implemented unless the repository changes to include and run them.
