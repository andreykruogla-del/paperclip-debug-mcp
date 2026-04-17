# Issue-Centric Public Beta Decision

> Status: historical decision note, superseded on 2026-04-17 by `docs/run-aware-public-beta-decision.md`.

## What was validated at the time

- Authenticated deployment preflight and baseline runtime checks (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`) are validated.
- Issue-centric investigation flow is validated as usable in the target authenticated deployment:
  - issue listing and issue comments retrieval,
  - incident prioritization from issue-backed signals,
  - incident packet flow with issue context.
- Run fallback signaling was explicit and machine-usable (derived-source visibility was clear in payloads).

## What was not validated at the time

- Run-centric investigation is not validated as operationally usable in the target authenticated deployment:
  - `paperclipDebug.list_runs` returns empty results,
  - `paperclipDebug.get_run_events` returns empty results,
  - `paperclipDebug.trace_handoff` returns empty results.
- Incident packets remain partial for run context in that deployment.

## Why run-centric beta promises were considered misleading

- At that checkpoint, field validation showed null-valued run linkage in sampled authenticated issue data.
- At that checkpoint, claiming run-centric readiness would have overstated operator capabilities in that environment.

## Safe public beta scope at that checkpoint

- Public beta messaging and release scope should be issue-centric:
  - issue triage and issue-context packet workflows,
  - collector-backed incident normalization/prioritization,
  - machine-usable degraded signaling under partial deployment compatibility.
- Run-centric capabilities may remain present in the product surface, but should be presented as deployment-data dependent and not currently validated as usable in the target authenticated deployment.

## What needed to change before run-centric claims could be enabled

Before enabling run-centric public claims, authenticated field validation in target deployment(s) needed to show:

- non-null issue-to-run linkage values in upstream/source data for relevant issue slices, and
- non-empty, operator-usable outputs for:
  - `paperclipDebug.list_runs`
  - `paperclipDebug.get_run_events`
  - `paperclipDebug.trace_handoff`
- incident packet flow with non-partial run context where run-linked cases exist.

## Recommendation at that checkpoint

- This document recorded a **conditional go** for issue-centric scope and **no-go** for run-centric claims at that time.
- The active recommendation has since moved to run-aware scope in `docs/run-aware-public-beta-decision.md`.
