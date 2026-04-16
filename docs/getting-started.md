# Getting Started

This guide helps you run Paperclip Debug MCP for the first time and validate that your setup is healthy.

## Prerequisites

Before you start, make sure you have:

- Node.js 22 (recommended to match CI/runtime expectations)
- npm
- Access to the runtime services you want to diagnose (for example Paperclip API and Docker)
- Environment values required for your setup (see `.env.example`)

## Installation

Install project dependencies:

```bash
npm install
```

## Basic Setup

Create your local environment file:

```bash
cp .env.example .env
```

Then fill in the required values in `.env` for your environment.

Minimal first-run focus:

- Keep default collector flags unless you know you need changes.
- Set Paperclip credentials and identifiers if you plan to use Paperclip-backed tools.

## Environment Check

Run the built-in diagnostics:

```bash
npm run doctor
npm run smoke:live
```

What to look for:

- `doctor` should confirm critical config/runtime readiness.
- `smoke:live` should complete without blocking errors.

If either command fails, fix `.env` values first, then rerun both commands.

## First MCP Run

Start one transport mode.

Local stdio mode:

```bash
npm run mcp:stdio
```

HTTP mode:

```bash
npm run mcp:http
```

Use `mcp:stdio` when your MCP client connects locally through stdio.
Use `mcp:http` when your client or tooling expects HTTP endpoints.

## First Diagnostic Flow

For your first practical triage, use the existing playbook sequence in `docs/mcp-playbook.md`.

Recommended quick path:

1. `paperclipDebug.get_runtime_config`
2. `paperclipDebug.list_collectors`
3. `paperclipDebug.refresh_collectors`
4. `paperclipDebug.system_snapshot`
5. `paperclipDebug.prioritize_incidents`

This gives you a fast validation that collectors are active and incident data is queryable.

## What to Read Next

- `docs/mcp-playbook.md` for investigation call sequences by scenario.
- `docs/runtime-profiles.md` for ready `.env` profiles.
- `docs/collector-adapter-guide.md` if you want to add a new adapter.
- `README.md` for the project-level overview and tool map.
