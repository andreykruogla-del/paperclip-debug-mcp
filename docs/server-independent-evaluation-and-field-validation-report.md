# Server Independent Evaluation and Field Validation Report

## External-user understanding before installation
From an external read of `README.md` and onboarding docs, the product appears to be an MCP-first investigation backend for Paperclip-heavy agent operations, not a generic observability stack.

What I understood before touching runtime:

- What it is:
  - A single MCP tool surface that aggregates Paperclip API signals, Docker/service signals, and optional adapter health into triage-oriented outputs (`summary`, `topSignals`, `recommendedNextTools`, `correlationHints`).
  - A backend/control layer for incident investigation workflows, run/issue/service drill-down, and packet-style handoff.
- Who it is for:
  - Operators/engineers running Paperclip + multiple agents + multiple runtime services who need faster incident routing and machine-usable diagnostics.
- What it is not:
  - Not a dashboard/UI product in this repository.
  - Not a full observability platform replacement.
  - Not a non-MCP-first product surface.
- Expected first-run experience (before real execution):
  - `npm install`, copy `.env`, run `doctor`/`smoke:live`, then choose `mcp:stdio` or `mcp:http`, and execute playbook flow.
  - Expected graceful behavior for partially configured adapters and actionable remediation messages.

## Documentation and onboarding gaps
Observed from an external-user perspective before and during validation:

- Terminology mismatch risk:
  - Docs position product as Paperclip-backed triage layer, but do not clearly state required Paperclip API compatibility assumptions (exact endpoint shapes/availability for runs/issues/comments in deployed Paperclip versions).
- Authentication expectations are under-specified for authenticated Paperclip deployments:
  - Docs say “fill required Paperclip settings,” but do not provide a concrete operator path for obtaining a valid token in authenticated server deployments.
- First-run commands can hide partial degradation:
  - `smoke:live` can exit successfully while Paperclip-backed API calls are failing (401/404) in runtime.
- HTTP transport troubleshooting is only partially explicit:
  - Port conflict guidance exists in checklist, but onboarding could surface it earlier in “first run” and provide copy-paste conflict checks.
- Tool-level argument guidance is thin for external operators:
  - Playbook has sequence guidance, but quick “required arguments by tool + source of IDs” is still easy to misinterpret in live conditions.

## Environment used
- Validation target:
  - Real Linux server already running Paperclip, multiple agents, and multiple Docker services.
- Host/runtime:
  - Ubuntu 24.04 LTS environment.
  - Node.js: `v24.14.1` (Node 22 not present; used exact available version).
  - npm: `11.11.0`.
- Paperclip environment facts:
  - Running as authenticated deployment mode.
  - Public URL configured: `https://paperclip.simfi-mebel.ru`.
  - Internal service reachable at `http://127.0.0.1:3110`.
  - Target company ID used: `4cb18376-e911-41f4-a531-ba33c940265f`.

## Configuration scope
`.env` was created from `.env.example` and configured for this live server with minimal relevant scope:

- Enabled:
  - `PAPERCLIP_COLLECTOR_ENABLED=true`
  - `DOCKER_COLLECTOR_ENABLED=true`
- Core Paperclip values set:
  - `PAPERCLIP_BASE_URL=http://127.0.0.1:3110`
  - `PAPERCLIP_COMPANY_ID=4cb18376-e911-41f4-a531-ba33c940265f`
  - `PAPERCLIP_TOKEN` set (token value intentionally redacted in report)
- Transport:
  - `MCP_HTTP_PORT=8799` initially (later validated on `8801` because of occupied port conflict)
  - `MCP_HTTP_AUTH_TOKEN` left empty for local validation.
- Optional adapters kept disabled (by intent for scoped server pass):
  - file, wordpress, caddy, sentry, k8s, postgres, redis.

## Validation results
Legend for issue category:
- `DOC_GAP` = docs/onboarding clarity issue
- `CONFIG_GAP` = config setup ambiguity/mismatch
- `ENV_ISSUE` = server/runtime condition external to product code
- `RUNTIME_BUG` = product/runtime behavior defect

| Step | Result | Evidence | Classification |
|---|---|---|---|
| `git pull origin main` | PASS | latest `main` pulled before validation | n/a |
| Prerequisites check | PASS | Node `v24.14.1`, npm `11.11.0` | n/a |
| `npm install` | PASS | dependencies installed cleanly | n/a |
| `.env` from `.env.example` | PASS | created and populated with scoped server values | n/a |
| `npm run doctor` | PASS (degraded) | command succeeded; reported Paperclip collector lastError `401 Unauthorized` on issues endpoint | `CONFIG_GAP` (valid auth token not available) + `DOC_GAP` (token acquisition path unclear) |
| `npm run smoke:live` | PASS (low-signal) | exited 0; no blocking output despite Paperclip API degradation | `DOC_GAP` (success criteria too implicit) |
| `npm run mcp:stdio` | PASS | server starts; long-running process validated with timeout run | n/a |
| `npm run mcp:http` (port 8799) | FAIL | `listen EADDRINUSE: address already in use :::8799` | `ENV_ISSUE` |
| HTTP `/healthz` check | PASS | `200 OK` with `{ok:true,...}` payload | n/a |
| `npm run mcp:http` with port override (`MCP_HTTP_PORT=8801`) | PASS | server started and `/healthz` returned 200 | n/a |
| `npm run check` | PASS | TypeScript noEmit check passed | n/a |
| `npm run test` | PASS | 21 test files, 50 tests passed | n/a |
| `npm run build` | PASS | clean + compile passed | n/a |

Notes on API compatibility observed during field validation:
- Multiple Paperclip-dependent calls returned endpoint/auth failures:
  - `401 Unauthorized` for issue paths in authenticated mode.
  - `404 API route not found` for run-log/run endpoints expected by current collector/tooling path.

## Live triage flow results
Executed via live MCP server session (`mcp:stdio`) against the configured server.

Minimum required flow:
1. `paperclipDebug.get_runtime_config` -> PASS
2. `paperclipDebug.list_collectors` -> PASS
3. `paperclipDebug.refresh_collectors` -> PASS
4. `paperclipDebug.system_snapshot` -> PASS
5. `paperclipDebug.prioritize_incidents` -> PASS

Additional tools executed:
- `paperclipDebug.list_issues` -> PASS (tool call) with Paperclip API `401` payload
- `paperclipDebug.get_issue_comments` -> PASS (tool call) with API error payload
- `paperclipDebug.list_runs` -> PASS (tool call) with API `404` payload
- `paperclipDebug.get_run_events` -> PASS (tool call) with API `404` payload
- `paperclipDebug.trace_handoff` -> PASS
- `paperclipDebug.list_services` -> PASS
- `paperclipDebug.get_service_logs` -> PASS
- `paperclipDebug.build_incident_packet` -> PASS (tool call) with API `401` payload

Quality of triage output (field assessment):
- `summary` usefulness:
  - Good for quick baseline framing (incident counts, service counts, degraded dependencies).
- `topSignals` usefulness:
  - Meaningful and correctly pointed to collector/API failure state.
- `recommendedNextTools` usefulness:
  - Helpful for reducing manual loops; suggestions were coherent with observed degradation.
- `correlationHints` usefulness:
  - Useful in this run (“dependency” lane due collector/API failure), not noisy.
- Weak areas:
  - Paperclip endpoint/auth failures are surfaced, but external operator still needs clearer “what to fix first” mapping for authenticated deployments and endpoint-compat mismatches.
  - Some tool calls return plain error strings; structured error envelopes would improve machine routing.

## What worked well
- MCP surface discovery and tool availability were straightforward once server was running.
- Docker/service-side diagnostics worked in the real multi-service environment.
- Triage guidance fields (`summary`, `topSignals`, `recommendedNextTools`, `correlationHints`) provided operational value even when core Paperclip APIs were degraded.
- Core quality gates (`check`, `test`, `build`) were clean on the live server runtime.

## Friction and failures
- Authenticated Paperclip deployment created immediate operational friction:
  - Valid API token path for external evaluator was not documented concretely.
- Endpoint compatibility friction:
  - Expected run endpoints in tooling produced `404 API route not found` against the deployed Paperclip API surface.
- Transport friction:
  - `mcp:http` failed on occupied default-configured port in first attempt (`EADDRINUSE`), requiring override.
- Observability friction in smoke path:
  - `smoke:live` pass did not clearly communicate degraded Paperclip-backed coverage.

## Product feedback
- Keep current scope (no feature expansion needed for this PR), but harden operator clarity:
  - Make authentication/deployment-mode prerequisites explicit in onboarding.
  - Promote a “compatibility check” step for Paperclip endpoint surface before full triage runs.
  - Return structured error payloads consistently (code/type/remediation/source) for tool-level API failures.
  - Ensure smoke path clearly distinguishes “runtime up” vs “core data plane degraded.”

## Release decision impact
Field result impact on release confidence:

- Positive:
  - Core MCP runtime and non-Paperclip parts of triage loop are operational in a real multi-service server.
  - Typecheck/test/build gates are healthy.
- Blocking concerns for public-beta operator expectations:
  - Authenticated Paperclip integration path is under-documented for external users.
  - Live endpoint compatibility mismatches (401/404) can leave Paperclip-dependent triage paths partially unusable.

Decision impact:
- Public-beta readiness should be treated as **conditional / not yet fully ready** for authenticated Paperclip deployments until auth + endpoint compatibility guidance is tightened and validated on matching Paperclip API surface.

## Top 5 highest-value follow-up improvements
1. Add explicit “authenticated deployment token acquisition” playbook in `docs/getting-started.md` with concrete operator steps and verification command.
2. Add preflight Paperclip API compatibility checks (issue/runs/comments endpoints) to `doctor` output with clear pass/fail matrix and remediation hints.
3. Standardize tool error outputs into structured JSON (`errorType`, `source`, `httpStatus`, `remediation`) instead of plain text strings.
4. Upgrade `smoke:live` summary to fail or warn loudly when core Paperclip data plane is inaccessible despite process-level success.
5. Add a short “port already in use” troubleshooting block to getting-started (before transport run) with copy-paste checks and override example.
