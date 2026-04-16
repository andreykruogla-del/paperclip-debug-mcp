# Paperclip Debug MCP

`Paperclip Debug MCP` - MCP-first слой для диагностики инцидентов в агентных системах на базе Paperclip.

## Что это и зачем

Когда инциденты разбираются через набор разрозненных инструментов, команда тратит время на ручную сборку контекста: логи, ран-события, issue-комментарии, состояние сервисов.

`Paperclip Debug MCP` дает один интерфейс для расследования: агент запрашивает структурированные данные и быстрее приходит к рабочей гипотезе причины.

Ориентир по эффекту (внутренние замеры, как диапазоны):

- Time to first root-cause hypothesis: `-40% ... -85%`
- Debug loops per incident: `-30% ... -70%`
- Tokens per resolved incident: `-25% ... -65%`
- Time to build evidence packet: `-60% ... -95%`

## Единый контрольный слой

Ключевая идея проекта: вместо набора отдельных утилит (Paperclip UI/API, docker logs, infra-checks, ручные заметки) используется единый контрольный слой с адаптерами.

Этот слой:

- нормализует сигналы из разных источников в общий формат инцидентов;
- отдает данные через единый MCP surface;
- поддерживает adapter-driven расширение без переписывания core tooling.

Сейчас в контуре: Paperclip API + Docker + optional health adapters (WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, Redis) + host file logs.

## Что вы получаете

- Быстрый triage и приоритизация инцидентов.
- Кластеризацию по fingerprint и анализ трендов.
- Handoff trace по run-связям между ролями/этапами.
- Единые запросы к runs, events, issues, comments, services и logs.
- Сборку incident packet для handoff и аудита.
- Базовую редактирующую защиту: redaction token-like секретов в excerpt-данных.

## Quick Start

```bash
npm install
cp .env.example .env
npm run doctor
npm run smoke:live
npm run mcp:stdio
# или
npm run mcp:http
```

Экспорт пакета инцидента:

```bash
npm run incident:packet -- --issue-id <issue-id>
# или
npm run incident:packet -- --run-id <run-id>
```

Базовая конфигурация задается через `.env` (см. `.env.example`). Ключевые переменные: `PAPERCLIP_BASE_URL`, `PAPERCLIP_TOKEN`, `PAPERCLIP_COMPANY_ID`, флаги включения коллекторов и параметры HTTP-транспорта.

## Документация

- [MCP Playbook](docs/mcp-playbook.md) - готовые диагностические последовательности.
- [Runtime Profiles](docs/runtime-profiles.md) - практичные `.env` профили под типовые стеки.
- [Collector Adapter Guide](docs/collector-adapter-guide.md) - как добавлять новые адаптеры.

## MCP Tools

Core tools:

- `paperclipDebug.get_runtime_config`
- `paperclipDebug.list_collectors`
- `paperclipDebug.refresh_collectors`
- `paperclipDebug.list_incidents`
- `paperclipDebug.list_incident_clusters`
- `paperclipDebug.incident_trends`
- `paperclipDebug.prioritize_incidents`
- `paperclipDebug.trace_handoff`
- `paperclipDebug.list_runs`
- `paperclipDebug.get_run_events`
- `paperclipDebug.list_issues`
- `paperclipDebug.get_issue_comments`
- `paperclipDebug.list_services`
- `paperclipDebug.get_service_logs`
- `paperclipDebug.build_incident_packet`
- `paperclipDebug.system_snapshot`

Optional adapter tools:

- `paperclipDebug.wordpress_health`
- `paperclipDebug.caddy_health`
- `paperclipDebug.sentry_health`
- `paperclipDebug.k8s_health`
- `paperclipDebug.postgres_health`
- `paperclipDebug.redis_health`

## Транспорты

- `mcp:stdio` - локальный stdio режим для MCP клиентов.
- `mcp:http` - streamable HTTP MCP сервер.

HTTP endpoints:

- `POST /mcp`
- `GET /mcp`
- `DELETE /mcp`
- `GET /healthz`

Опционально поддерживается bearer auth через `MCP_HTTP_AUTH_TOKEN`.

## Текущий статус

Проект находится в active beta с рабочими коллекторами и инструментами расследования.

Текущий scope:

- MCP server (`stdio` + `http`)
- Paperclip API collector (issues/comments/runs/events)
- Docker collector (services/logs)
- Filesystem log collector
- Optional ecosystem adapters: WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, Redis
- Incident clustering, trends, prioritization, handoff trace
- Incident packet builder и CLI export

## Разработка

Основные команды качества и сборки:

```bash
npm run check
npm run build
npm run test
```

Сервисные команды:

```bash
npm run doctor
npm run smoke:live
npm run benchmark:report -- --input-dir ./artifacts --output ./artifacts/benchmark.md
npm run collector:new -- --name wordpress --kind external
```

При добавлении нового optional adapter обновляйте синхронно: `README.md`, `.env.example` и `docs/runtime-profiles.md`.
