# Roadmap

## Current state

Paperclip Debug MCP is in active beta with a working MCP-first debugging surface.

Today the project already includes:

- A unified MCP tool layer for incident triage, investigation, and packet building.
- Core data collection from Paperclip API, Docker, and optional filesystem logs.
- Optional dependency adapters for WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, and Redis.
- Incident analysis primitives: clustering, prioritization, trends, handoff tracing, and packet composition.
- Two runtime transports (`stdio` and streamable HTTP), with optional HTTP bearer auth.
- A growing documentation set (getting started, configuration, tools reference, adapter matrix, playbook, architecture).

## Near-term priorities

1. Improve triage orchestration quality
- Tighten default investigation flows across `system_snapshot`, prioritization, and service/dependency drill-down.
- Strengthen consistency of tool outputs used in first-response triage.

2. Increase operational reliability of adapters
- Improve robustness of adapter health paths (clearer error surfaces, stable diagnostics under partial config).
- Keep adapter behavior predictable when sources are unavailable or partially configured.

3. Raise documentation-to-runtime alignment
- Keep docs synchronized with tool schemas and runtime config behavior as adapters evolve.
- Maintain one clear onboarding path from setup -> preflight -> first triage -> packet export.

4. Stabilize CI and release hygiene
- Preserve lockfile/runtime consistency and prevent install/check regressions from blocking doc-only and product PRs.

## Mid-term priorities

1. Deeper investigation depth per source
- Expand incident enrichment quality from existing sources (better correlation among runs, issues, services, and dependency signals).
- Improve handoff packet usefulness for cross-role incident workflows.

2. Better cross-source correlation
- Strengthen linkage between collector outputs so high-priority incidents map faster to likely failing subsystem.
- Improve confidence of “what to check next” transitions in triage flows.

3. Adapter expansion in the same architecture
- Add new optional adapters only through the existing collector + normalized incident model pattern.
- Preserve compatibility with current MCP tool contracts while expanding source coverage.

4. Usability improvements for operators and agents
- Reduce repeated manual query loops by improving recommended call sequences and output clarity.
- Make high-signal diagnostic paths easier to execute under incident pressure.

## Longer-term direction

1. Mature incident intelligence layer
- Evolve from tool-by-tool diagnostics toward stronger investigation guidance built on the same MCP surface.
- Increase consistency and confidence of root-cause narrowing across heterogeneous runtime stacks.

2. Broader ecosystem support without architecture drift
- Continue adapter growth while preserving the single control-layer model (collect -> normalize -> analyze -> expose via MCP).

3. Operational maturity for sustained production usage
- Improve repeatability of incident workflows, artifact quality, and troubleshooting reliability across environments.

## What is intentionally out of scope for now

- Building a separate dashboard/UI product inside this repository.
- Replacing MCP with a non-MCP primary interface.
- Introducing unrelated platform features that do not map to incident collection, normalization, analysis, or investigation workflows.
- Large architectural rewrites that break the current collector-first model before incremental maturity goals are met.
