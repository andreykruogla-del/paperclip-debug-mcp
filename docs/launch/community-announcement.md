# Community Announcement

Paperclip Debug MCP is now in run-aware public beta for validated authenticated deployment profiles.

What is usable now:

- issue-centric triage (`list_issues`, `get_issue_comments`, prioritization, packet flow)
- run-aware investigation (`list_runs`, `get_run_events`, `trace_handoff`)
- one MCP surface for issue, run, event, service, and handoff workflows

Important caveat: run-aware behavior remains deployment-data dependent (stable run-linked source data and linkage aliases are required). This is not a universal compatibility claim, and optional adapters are not broadly validated in this beta decision surface.

See README plus public-beta decision/readiness docs for the current validated scope and deployment-fit guidance.
