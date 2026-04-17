# Runs Plane Compatibility Validation Report

## Live deployment behavior observed

- Validation target: `https://paperclip.simfi-mebel.ru` (same deployment family as previous field-validation evidence).
- Known context from prior authenticated field pass: issue-side investigation became usable, but `doctor.paperclipPreflight.checks.runs` still reported `endpoint_mismatch`.
- In this repository environment, valid authenticated credentials were not available, so route-level probing used an intentionally invalid bearer token to separate:
  - route not found (`404`), and
  - auth-gated but reachable route (`401`).

Observed statuses from probe:

- `401`: `/api/companies/{companyId}/issues?limit=1`
- `404`: all tested run list variants:
  - `/api/runs?limit=5`
  - `/api/runs?take=5`
  - `/api/run-logs?limit=5`
  - `/api/companies/{companyId}/runs?limit=5`
  - `/api/companies/{companyId}/runs?take=5`
  - `/api/companies/{companyId}/run-logs?limit=5`

This indicates a real route-shape mismatch for dedicated runs-plane endpoints on that deployment surface, while issue routes remain reachable.

## Routes/payload shapes that were actually usable

Usable in observed deployment family:

- `GET /api/companies/{companyId}/issues` (auth-gated, returned `401` with invalid token, therefore route exists)
- `GET /api/issues/{issueId}/comments` (already used by existing issue-side integration path)

Not observed as usable in this deployment family:

- dedicated runs list and run events routes previously used by this repository and tested company-scoped variants.

## Changes made

Code:

- `src/integrations/paperclip-runs.ts`
  - broadened runs route variants to include company-scoped runs paths,
  - added conservative fallback for `listRuns` when category is `endpoint_mismatch` and `companyId` is available:
    - derive run summaries from issue records (`relatedRunId`),
  - added conservative fallback for `getRunEvents` when category is `endpoint_mismatch` and `companyId` is available:
    - derive run-related timeline from issue metadata and issue comments.
- `src/mcp/server.ts`
  - pass `PAPERCLIP_COMPANY_ID` / `PAPERCLIP_PROJECT_ID` into run integrations so fallback can activate for MCP tools:
    - `paperclipDebug.list_runs`
    - `paperclipDebug.get_run_events`
    - packet and snapshot paths that call run integrations.
- `scripts/doctor.ts`
  - pass company/project context into runs preflight check.
- `scripts/smoke-live.ts`
  - pass company/project context into runs check.
- `src/integrations/paperclip-runs.test.ts`
  - new tests for:
    - list-runs fallback from endpoint mismatch to issues,
    - run-events fallback from endpoint mismatch to issue comments,
    - preserved explicit `endpoint_mismatch` when no fallback context exists.

## Revalidation results

Repository validation:

- `npm run check` -> pass
- `npm run test` -> pass (58 tests)

Live probe and diagnostic re-check:

- route probe to `https://paperclip.simfi-mebel.ru` confirmed:
  - issues route reachable/auth-gated (`401`),
  - tested run routes still `404`.
- `npm run doctor` with live base URL + company id + intentionally invalid token:
  - `paperclipPreflight.checks.runs.status = "error"`
  - `errorCategory = "auth_failure"` (not `endpoint_mismatch`)
- `npm run smoke:live` under same probe config:
  - Paperclip degraded due `auth_failure`, not runs route mismatch.

Requested authenticated MCP tool revalidation (`list_runs`, `get_run_events`, `trace_handoff`, `system_snapshot`, `prioritize_incidents`) could not be completed in this environment because valid deployment credentials were unavailable.

## Remaining gaps if any

- Remaining gap is no longer primarily route compatibility; it is authenticated access evidence:
  - a fresh pass with valid `PAPERCLIP_TOKEN` is required to confirm:
    - `paperclipDebug.list_runs` returns usable run summaries in target deployment,
    - `paperclipDebug.get_run_events` returns usable events in target deployment,
    - run-centric handoff flow quality under real auth.
- If target deployment exposes dedicated run endpoints in some environments, those exact route variants should be captured and added to regression fixtures.

## Public beta impact

- Impact: high-value blocker reduced from **runs endpoint mismatch** to **auth-validated usability confirmation**.
- Recommendation update: the project is better positioned for a fresh authenticated re-validation pass; final public-beta go/no-go should still require that pass with valid credentials.
