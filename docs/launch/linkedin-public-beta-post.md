# LinkedIn Public Beta Post

We're opening a run-aware public beta for Paperclip Debug MCP.

The problem we kept seeing was context fragmentation during incident response: teams had to jump between issue threads, run events, logs, and service checks before they could form a usable root-cause path.

Paperclip Debug MCP is our answer to that: one MCP investigation layer for issue triage, run-aware investigation, service context, and handoff evidence.

In the current beta posture, we've validated issue-centric workflows and run-aware flows (`list_runs`, `get_run_events`, `trace_handoff`) in authenticated deployment profiles, including non-empty handoff tracing on fresh cases.

Important caveat: this is deployment-data dependent. We're not claiming universal compatibility across all deployment shapes, and we're not claiming broad optional-adapter validation yet.

If you run authenticated Paperclip environments and want to test an MCP-first incident workflow, we'd value early feedback on setup clarity, run-aware usefulness, and handoff quality.
