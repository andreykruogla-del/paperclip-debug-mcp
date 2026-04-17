# Public Beta Readiness Report

## Current assessment

Current release-candidate status is **conditional go for issue-centric public beta scope**.
Run-centric investigation is still not operationally usable in the validated authenticated deployment, so run-centric beta claims remain out of scope.

### Final authenticated runs revalidation update (2026-04-17)

- Final pass executed on real authenticated server environment with valid credentials.
- `doctor` result: `paperclipPreflight.status=ok`; prior runs-plane `endpoint_mismatch` blocker is no longer present.
- Runs path behavior now degrades to explicit fallback (`sourcePath` suffix `#derived_from_issues`) instead of mismatch failure.
- In this target deployment, run-centric outputs remain empty:
  - `paperclipDebug.list_runs` -> `totalRuns=0` (fallback source)
  - `paperclipDebug.get_run_events` -> `totalEvents=0` (fallback source)
  - `paperclipDebug.trace_handoff` -> `totalTraces=0`
- Additional signal: `system_snapshot.summary.runs=0`, `prioritize_incidents.summary.hasRunLinkedIncidents=false`, `build_incident_packet` has `hasRunContext=false`.

Evidence used in this pass:

- Checklist framework: `docs/release-readiness-checklist.md`
- Runtime/diagnostic commands run in authenticated server environment:
  - `npm install`
  - `npm run doctor`
  - `npm run smoke:live`
  - `npm run mcp:stdio`
  - `npm run mcp:http` + `GET /healthz`
  - Run-centric MCP flow (`list_runs`, `get_run_events`, `trace_handoff`) plus context tools
- Final validation evidence:
  - `docs/final-authenticated-runs-revalidation-report.md`
  - `docs/issue-centric-public-beta-decision.md`

## What is already ready

1. Release surface and scope posture
- `package.json` remains intentionally guarded with `private: true`.
- Version remains in `0.x` beta posture (`0.1.0`).
- Repository-facing metadata is present and points to canonical project URLs.
- Issue-centric scope can be stated explicitly and honestly without claiming run-centric readiness.

2. Local setup and baseline diagnostics
- Dependency install succeeded.
- `doctor` now includes Paperclip preflight compatibility classification.
- `doctor` no longer reports runs-plane `endpoint_mismatch` in this authenticated deployment.
- `smoke:live` and transport startup checks pass.

3. Transport baseline
- `mcp:stdio` starts without immediate runtime failure.
- HTTP transport health endpoint validated (`200`) in authenticated server run (`/healthz`).

4. Documentation/readiness structure
- Public-beta checklist exists and now captures skipped-item recording and port-conflict handling.
- Getting-started guidance now includes a concrete authenticated Paperclip deployment quick-check path.
- Positioning and readiness documents remain aligned with collector-first MCP direction.
- Issue-centric decision framing is now documented explicitly in `docs/issue-centric-public-beta-decision.md`.

## What is not yet fully validated

1. Run-centric operational usability in authenticated deployment
- Final authenticated pass completed, but run-centric tools currently return empty data only.
- Fallback behavior is explicit and machine-usable, but operationally insufficient for real run investigation in this deployment.

2. Optional adapter deep validation
- WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, and Redis were not configured in this pass, so only skip-path behavior was validated.

3. Auth-enabled HTTP transport behavior
- `MCP_HTTP_AUTH_TOKEN` was not set in this pass, so token-protected HTTP validation was not executed.

## Blocking issues before run-centric public beta claims

1. Run-centric path remains non-usable in target authenticated deployment
- Evidence: `list_runs.totalRuns=0`, `get_run_events.totalEvents=0`, `trace_handoff.totalTraces=0`.

2. Incident packet remains issue-only for validated context
- Evidence: `build_incident_packet.packetReadiness.checks.hasRunContext=false` and `runEvents=0`.

## Non-blocking follow-ups after public beta

1. Expand adapter validation matrix over time
- Add periodic environment-specific validation runs for selected optional adapters without changing product scope.

2. Keep docs/runtime alignment tight as output shapes evolve
- Continue lightweight alignment checks when triage guidance fields or transport behavior are adjusted.

3. Keep release-candidate memo discipline
- Re-run this report template for each meaningful release-candidate checkpoint.

## Recommended public beta decision now

**Recommendation: conditional go for issue-centric scope; no-go for run-centric claims.**

Reasoning:

- Authenticated mismatch blocker is resolved and fallback signaling is explicit.
- Issue-centric workflows are validated and useful in the target deployment.
- Run-centric workflows remain empty because deployment source run-linkage data is currently null in practice.

Scope guard for public beta messaging:

- Allowed now: issue-centric investigation value proposition.
- Deferred: run-centric investigation promises until upstream/source evidence shows non-empty run linkage and usable run/event/handoff outputs in authenticated field validation.
