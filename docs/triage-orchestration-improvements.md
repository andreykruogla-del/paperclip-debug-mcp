# Triage Orchestration Improvements

## Current triage flow

Current triage is already well supported by the MCP surface, but orchestration is mostly operator-driven.

Typical flow today:

1. Preflight
- `paperclipDebug.get_runtime_config`
- `paperclipDebug.list_collectors`
- `paperclipDebug.refresh_collectors`

2. Fast triage
- `paperclipDebug.system_snapshot`
- `paperclipDebug.prioritize_incidents`
- `paperclipDebug.list_services`
- `paperclipDebug.incident_trends`

3. Branch into a deep path
- Run path: `list_runs` -> `get_run_events` -> `trace_handoff`
- Issue path: `list_issues` -> `get_issue_comments` -> `build_incident_packet`
- Service path: `list_services` -> `get_service_logs`
- Dependency path: adapter health tool -> `refresh_collectors` -> `prioritize_incidents`

4. Evidence and handoff
- `paperclipDebug.build_incident_packet`
- Optional script export (`npm run incident:packet`) and benchmark report generation.

## Current pain points

1. Manual routing remains high
- Operators/agents must decide the next branch from raw outputs.
- There is no explicit “recommended next step” signal in tool responses.

2. Cross-tool correlation is implicit
- Tools expose useful data, but linking service, run, issue, and dependency evidence still requires manual synthesis.

3. Output shape for decision-making is uneven
- Some tools return strong summary sections, while others return mostly raw data.
- This increases repeated query loops under pressure.

4. Playbook execution quality depends on user discipline
- The playbook is clear, but enforcement/guidance is external to the tools.

## Improvement goals

1. Reduce manual “where to go next” decisions.
2. Improve consistency of triage-oriented summaries across tools.
3. Keep improvements compatible with current collector-first architecture.
4. Avoid breaking existing MCP contracts used by agents.

## Candidate improvements

### A) Documentation-level improvements

1. Add a compact decision table to triage docs
- Input: dominant signal type (service failure, run failure, issue escalation, dependency health failure).
- Output: recommended next tool chain.

2. Add “stop conditions” per scenario
- Example: when to stop querying services and switch to run/issue packetization.

3. Add role-focused quick paths
- Same tools, but grouped for incident commander vs implementation operator.

### B) Output-shape-level improvements (without changing architecture)

1. Standardize triage metadata block in key tools
- Proposed common fields where practical: `summary`, `topSignals`, `recommendedNextTools`.
- Start with `system_snapshot`, `prioritize_incidents`, and adapter health responses.

2. Add explicit correlation hints
- Example hints: likely affected service/source, related run concentration, dominant severity band.

3. Normalize error/config guidance
- Keep explicit `configured: false` patterns and make remediation hints consistently concise.

### C) Tool-level improvements (incremental)

1. Add a guidance-oriented tool for first response
- A lightweight orchestration helper that reads current state and returns a ranked next-step call list.
- Should compose existing collectors/analysis, not replace them.

2. Extend `system_snapshot` decision utility
- Include optional recommended branch labels (service path, run path, issue path, dependency path).

3. Improve packet readiness signals
- In packet-building outputs, expose clearer indicators of confidence/completeness for handoff.

## Small implementation phases

### Phase 1: Documentation hardening (low risk)
- Update triage docs with a compact decision matrix and stop conditions.
- No code changes, no contract risk.

### Phase 2: Summary consistency (low-to-medium risk)
- Add/align summary-style fields in selected existing tools.
- Keep existing response fields intact for backward compatibility.

### Phase 3: Correlation hints (medium risk)
- Add conservative, explainable correlation indicators in snapshot/prioritization outputs.
- Validate against current incident model and tests.

### Phase 4: Orchestration helper tool (medium risk)
- Introduce one optional “next-step guidance” MCP tool built on current registry + analysis outputs.
- Keep it advisory, not authoritative.

### Phase 5: Quality loop and adoption (ongoing)
- Measure reductions in debug loops and time-to-first-actionable hypothesis.
- Refine playbook and guidance outputs based on operator usage.

## What should stay unchanged

1. Collector-first architecture and adapter model.
2. Normalized incident-centric core model.
3. Existing MCP tool coverage for raw and analytical access.
4. Dual transport model (`stdio` + HTTP) and environment-driven runtime control.
5. Backward-compatible response contracts for currently exposed tools.
