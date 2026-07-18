# Shelf (anime_list) — Knowledge Base

This directory is the canonical, local-first knowledge system for the
**Shelf / MAL Explorer** product (`anime_list`). Markdown here is the source of
truth; code and executable configuration remain authoritative for
implementation details and schedules.

> Looking for a quick status snapshot? See [`../STATUS.md`](../STATUS.md).
> Looking for agent operating rules? See [`../AGENTS.md`](../AGENTS.md).

## How this knowledge base is organized

| Area | Path | What lives there |
| --- | --- | --- |
| Product | [`product/`](product/) | What the product is, who it serves, shipped features |
| Architecture | [`architecture/`](architecture/) | System design and durable technical decisions (ADRs) |
| Development | [`development/`](development/) | Local setup, commands, conventions |
| Operations | [`operations/`](operations/) | Deploy, scheduled jobs, runbooks |
| Knowledge | [`knowledge/`](knowledge/) | Reusable learnings and failed approaches |
| Archive | [`archive/`](archive/) | Completed/historical briefs and audits (preserved, not edited) |

## Entry points by role

- **New contributor / agent onboarding**: [`product/overview.md`](product/overview.md) → [`architecture/overview.md`](architecture/overview.md) → [`development/setup.md`](development/setup.md).
- **On-call / shipping**: [`operations/deploy.md`](operations/deploy.md) → [`operations/jobs.md`](operations/jobs.md) → [`operations/runbooks/`](operations/runbooks/).
- **Understanding why a system exists**: [`architecture/decisions/`](architecture/decisions/).
- **Avoiding a known dead end**: [`knowledge/failed-approaches.md`](knowledge/failed-approaches.md).
- **Non-obvious implementation tricks**: [`knowledge/learnings.md`](knowledge/learnings.md).

## Maintenance rules

1. Markdown committed here is the source of truth. Blume (see
   [`../blume.config.ts`](../blume.config.ts)) is only the presentation and
   search layer — never edit generated files under `.blume/` or `.blume-verify/`.
2. One fact, one home. Do not duplicate what code, `package.json`,
   `wrangler.cron.toml`, or the GitHub workflow files already state
   authoritatively — link to them instead.
3. Document *why* systems work, non-obvious constraints, operational
   procedures, decisions, and reusable failed approaches. Do not restate
   what is easily discoverable from code.
4. Prefer small, focused pages (target 150–300 lines). Split rather than grow
   a catch-all.
5. When a decision is superseded, mark the ADR `Superseded` and add a pointer
   to the replacement; do not delete history. Move completed/historical briefs
   into [`archive/`](archive/) rather than deleting them.
6. Mark unresolved questions explicitly (`> Unresolved:`). Do not invent
   information.
7. Before committing, run `node scripts/check-docs.mjs` to catch broken
   internal links. CI runs the same check on every push and PR
   (`.github/workflows/docs.yml`).
