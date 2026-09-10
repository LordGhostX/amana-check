# Amana Check

**Check before you share.**

A community-facing trust layer for fragile information environments. A rumor or question arrives in any language; Amana Check answers in that same language with what is actually known — sourced, dated, and actionable — and gives local peacebuilders an anonymous, aggregated signal of verification demand that exposes no one.

Built for the OSF × Andela hackathon "Information you can trust". Primary track: Stability & Social Cohesion, with Transparency & Accountability and Safety (referral pathways only) as complementary tracks.

## Status

**Phase 2 — Trust engine in progress.** Ingestion, chunking, extraction, deterministic retrieval, and the freshness gate are working against a live corpus. Answer synthesis with citations and the eval harness are next. See [docs/PLAN.md](docs/PLAN.md).

## Stack

- Next.js (App Router) + TypeScript strict + Tailwind CSS
- Postgres + Drizzle ORM (`postgres.js` driver); local Postgres in dev, Neon in production
- OpenRouter (DeepSeek 4.1 Flash → 4 Flash fallback) with hardcoded ZDR + no-training routing
- Zod validation at every model boundary, with deterministic fallbacks

## Setup

Requires [Bun](https://bun.sh) and a local Postgres.

```bash
bun install
createdb amana_check
cp .env.example .env          # then set OPENROUTER_API_KEY and IP_HASH_SECRET
bun run db:migrate
bun run db:seed
bun run dev
```

Generate `IP_HASH_SECRET` with `openssl rand -hex 32`.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the app |
| `bun run build` | Production build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run db:generate` | Generate Drizzle migrations from the schema |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed` | Load region registries and sources from `data/` |
| `bun run db:studio` | Drizzle Studio |
| `bun run ingest` | Fetch enabled sources into the corpus (flags: `--source`, `--country`, `--limit`) |
| `bun run check:llm` | Verify the fail-closed OpenRouter path |
| `bun run check:pipeline` | Run extraction → retrieval → freshness gate on a sample claim |

## Layout

```
src/app/                  English UI
src/lib/db/               Drizzle schema + client
src/lib/llm/              Fail-closed OpenRouter client + call logging
src/lib/locale/           HMAC IP hashing, Vercel geo headers
src/lib/registry/         Source/region registry schemas + loaders
src/lib/trust/            Answer and claim types
data/regions/             Nigeria (36 + FCT) and Kenya (47 counties)
data/sources/             Source registries with tiers, licenses, health
drizzle/                  Generated SQL migrations
scripts/                  Seed, ingestion, and checks
docs/                     Frozen plan
```

## Privacy posture

- `claims` stores de-identified input and has **no join keys** to any identifier.
- IPs are only ever `HMAC-SHA256(IP_HASH_SECRET, ip)` for rate limits and locale hints; raw IPs are never stored or logged.
- LLM routing is hardcoded to zero-retention, no-training endpoints. If none is available the request fails closed rather than degrading.
- Aggregated `events` are k≥3 and represent verification demand, not confirmed incidents.

See [docs/PLAN.md](docs/PLAN.md) for the full trust model and the retention tradeoff.
