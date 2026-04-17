# Public Beta Readiness Report

## Current assessment

Current release-candidate status is **public beta go for run-aware scope** in the validated authenticated deployment profile.
This updates the prior issue-centric-only conditional posture based on fresh authenticated field evidence after upstream/source contract fixes.

### Run-aware revalidation update (2026-04-17)

- Final pass executed on real authenticated server environment with valid credentials.
- Fresh controlled case confirmed upstream/source now emits run-linked handoff transitions in activity records.
- Issue payloads now expose stable linkage aliases (`runId`, `relatedRunId`) tied to run context.
- `paperclipDebug.trace_handoff` is non-empty on fresh authenticated case.
- Run-aware tool path is operationally usable:
  - `paperclipDebug.list_runs` -> non-empty run list from heartbeat runs route
  - `paperclipDebug.get_run_events` -> non-empty run events for fresh run
  - `paperclipDebug.trace_handoff` -> non-empty trace result for fresh run
- `paperclipDebug.build_incident_packet` now carries run context and non-empty run events on fresh case.

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
  - `docs/trace-handoff-fresh-case-root-cause-report.md`
  - `docs/run-aware-public-beta-decision.md`

## What is already ready

1. Release surface and scope posture
- `package.json` remains intentionally guarded with `private: true`.
- Version remains in `0.x` beta posture (`0.1.0`).
- Repository-facing metadata is present and points to canonical project URLs.
- Run-aware scope can now be stated explicitly with deployment-conditions caveats.

2. Local setup and baseline diagnostics
- Dependency install succeeded.
- `doctor` now includes Paperclip preflight compatibility classification.
- `doctor` no longer reports runs-plane mismatch blocker in validated authenticated deployment.
- `smoke:live` and transport startup checks pass.

3. Transport baseline
- `mcp:stdio` starts without immediate runtime failure.
- HTTP transport health endpoint validated (`200`) in authenticated server run (`/healthz`).

4. Documentation/readiness structure
- Public-beta checklist exists and now captures skipped-item recording and port-conflict handling.
- Getting-started guidance now includes a concrete authenticated Paperclip deployment quick-check path.
- Positioning and readiness documents remain aligned with collector-first MCP direction.
- Run-aware decision framing is documented in `docs/run-aware-public-beta-decision.md`.

## What is not yet fully validated

1. Optional adapter deep validation
- WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, and Redis were not configured in this pass, so only skip-path behavior was validated.

2. Auth-enabled HTTP transport behavior
- `MCP_HTTP_AUTH_TOKEN` was not set in this pass, so token-protected HTTP validation was not executed.

## Remaining cautions before broad rollout

1. Run-aware validity remains deployment-data dependent
- If upstream/source stops emitting run-linked transitions or linkage aliases regress, handoff traces can degrade again.

2. Optional adapters still require environment-specific confirmation
- Core Paperclip run/issue path is validated, but optional integrations remain outside this pass.

## Non-blocking follow-ups after public beta

1. Expand adapter validation matrix over time
- Add periodic environment-specific validation runs for selected optional adapters without changing product scope.

2. Keep docs/runtime alignment tight as output shapes evolve
- Continue lightweight alignment checks when triage guidance fields or transport behavior are adjusted.

3. Keep release-candidate memo discipline
- Re-run this report template for each meaningful release-candidate checkpoint.

## Recommended public beta decision now

**Recommendation: public beta go for run-aware scope in validated authenticated deployments.**

Reasoning:

- Authenticated mismatch blocker is resolved.
- Upstream/source now emits run-linked handoff transitions and issue linkage aliases.
- Issue-centric and run-aware workflows are both validated as operationally usable on fresh authenticated field case.

Scope guard for public beta messaging:

- Allowed now: issue-centric plus run-aware investigation value proposition.
- Required caveat: run-aware behavior is guaranteed only for deployments that expose equivalent source linkage contracts and run-linked transition data.
- Launch wording should stay practical: validated in authenticated deployments that match this profile, without universal-compatibility claims.
