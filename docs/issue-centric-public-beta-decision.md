# Issue-Centric Public Beta Decision

## What is validated today

- Authenticated deployment preflight and baseline runtime checks (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`) are validated.
- Issue-centric investigation flow is validated as usable in the target authenticated deployment:
  - issue listing and issue comments retrieval,
  - incident prioritization from issue-backed signals,
  - incident packet flow with issue context.
- Run fallback signaling is explicit and machine-usable (derived-source visibility is clear in payloads).

## What is not validated today

- Run-centric investigation is not validated as operationally usable in the target authenticated deployment:
  - `paperclipDebug.list_runs` returns empty results,
  - `paperclipDebug.get_run_events` returns empty results,
  - `paperclipDebug.trace_handoff` returns empty results.
- Incident packets remain partial for run context in that deployment.

## Why run-centric beta promises would currently be misleading

- Latest field validation confirms run-linkage-shaped fields exist in deployment payload schema, but values are null in practice for sampled authenticated issue data.
- This means current emptiness is not primarily a repository route/mapping mismatch anymore; it is an upstream/source-data reality in the validated deployment.
- Claiming run-centric readiness would overstate what operators can actually do today in that environment.

## Safe public beta scope now

- Public beta messaging and release scope should be issue-centric:
  - issue triage and issue-context packet workflows,
  - collector-backed incident normalization/prioritization,
  - machine-usable degraded signaling under partial deployment compatibility.
- Run-centric capabilities may remain present in the product surface, but should be presented as deployment-data dependent and not currently validated as usable in the target authenticated deployment.

## What must change before run-centric claims are enabled

Before enabling run-centric public claims, authenticated field validation in target deployment(s) must show:

- non-null issue-to-run linkage values in upstream/source data for relevant issue slices, and
- non-empty, operator-usable outputs for:
  - `paperclipDebug.list_runs`
  - `paperclipDebug.get_run_events`
  - `paperclipDebug.trace_handoff`
- incident packet flow with non-partial run context where run-linked cases exist.

## Recommendation

- **Conditional go** for issue-centric public beta scope now.
- **No-go** for run-centric beta claims until upstream/source run-linkage evidence becomes non-empty and run-centric authenticated field validation is operationally usable.
