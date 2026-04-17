# Run-Aware Public Beta Decision

## What is now validated

- Authenticated baseline runtime checks are validated in live deployment (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`).
- Issue-centric investigation is validated as operator-usable:
  - `paperclipDebug.list_issues`
  - `paperclipDebug.get_issue_comments`
  - `paperclipDebug.prioritize_incidents`
  - `paperclipDebug.build_incident_packet`
- Run-aware investigation is validated as operator-usable on fresh authenticated case:
  - `paperclipDebug.list_runs` returns non-empty run set
  - `paperclipDebug.get_run_events` returns non-empty run events
  - `paperclipDebug.trace_handoff` returns non-empty traces
  - packet flow includes run context and run events

## What changed from previous validation

- Upstream/source now emits explicit run-linked handoff transitions in source activity data.
- Issue payloads now expose stable run linkage aliases (`runId`, `relatedRunId`) tied to run context.
- The previously dominant blocker (empty run-centric output despite authenticated access) is resolved in fresh field validation.
- `trace_handoff` is now non-empty on fresh real case, instead of consistently empty.

## Remaining cautions

- This is not a blanket claim for every Paperclip deployment shape.
- Run-aware behavior remains deployment-data dependent:
  - source must emit run-linked transition records,
  - issue payload linkage aliases must remain present and stable.
- Optional adapters (WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, Redis) were not deep-validated in this decision pass.

## Safe public beta scope now

- Safe public beta scope is run-aware (issue-centric + run-centric investigation) for authenticated deployments matching the validated source linkage contract.
- Safe claims include:
  - issue triage and packet workflows,
  - run list and run-event investigation,
  - handoff tracing,
  - run-aware incident packet assembly.
- Messaging should retain one practical caveat: run-aware outcomes depend on source deployment emitting the validated linkage data contract.

## Recommendation

- **Public beta go** for run-aware scope in authenticated deployments that match the validated source contract.
- Keep release messaging disciplined:
  - avoid "works everywhere" wording,
  - keep deployment-condition caveat explicit,
  - continue fresh-case validation in release-candidate checkpoints.
