# Amana Check

**Check before you share.**

A community-facing trust layer for fragile information environments. A rumor or question arrives in any language; Amana Check answers in that same language with what is actually known — sourced, dated, and actionable — and gives local peacebuilders an anonymous, aggregated signal of verification demand that exposes no one.

Built for the OSF × Andela hackathon "Information you can trust". Primary track: Stability & Social Cohesion, with Transparency & Accountability and Safety (referral pathways only) as complementary tracks.

## Status

**Phases 1–5 complete.** The corpus, trust engine, citizen experience, accountability loop, and hardening are built and verified. Latest eval: 14/14 claims pass, extraction type 13/13, language detection 7/7, about $0.018 per full run. The red-team suite verifies privacy invariants, admin-session integrity, input bounds, citation enforcement, and live prompt-injection resistance. See [docs/PLAN.md](docs/PLAN.md) for the frozen plan and [docs/methodology.md](docs/methodology.md) for how decisions are made.

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

Ingestion falls back to `curl` for feeds that bot-block other HTTP clients (ReliefWeb country feeds). curl ships with macOS and GitHub's Ubuntu runners; set `INGEST_CURL_FALLBACK=0` to disable the fallback and fail fast instead.

## Scripts

| Command                  | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `bun run dev`            | Start the app                                                                     |
| `bun run build`          | Production build                                                                  |
| `bun run typecheck`      | `tsc --noEmit`                                                                    |
| `bun run lint`           | ESLint                                                                            |
| `bun run format`         | Format with Prettier                                                              |
| `bun run format:check`   | Verify formatting with Prettier                                                   |
| `bun run db:generate`    | Generate Drizzle migrations from the schema                                       |
| `bun run db:migrate`     | Apply migrations                                                                  |
| `bun run db:seed`        | Load region registries and sources from `data/`                                   |
| `bun run db:studio`      | Drizzle Studio                                                                    |
| `bun run ingest`         | Fetch enabled sources into the corpus (flags: `--source`, `--country`, `--limit`) |
| `bun run ask`            | Run the full pipeline on a claim (flags: `--ng`, `--ke`, `--fresh`)               |
| `bun run eval`           | Run the eval harness and write `eval/results/latest.json`                         |
| `bun run check:llm`      | Verify the fail-closed OpenRouter path                                            |
| `bun run check:pipeline` | Run extraction → retrieval → freshness gate on a sample claim                     |
| `bun run red-team`       | Run static privacy checks and live adversarial claims                             |

## Docs

- [docs/methodology.md](docs/methodology.md) — how answers are produced and validated
- [docs/threat-model.md](docs/threat-model.md) — assets, threats, mitigations, residual risk
- [docs/constraints-matrix.md](docs/constraints-matrix.md) — the seven brief constraints mapped to code
- [docs/future-directions.md](docs/future-directions.md) — SMS, USSD, offline, native review, expansion
- [docs/PLAN.md](docs/PLAN.md) — the frozen plan

## Layout

```
src/app/                  UI, answer card, admin console, API routes
src/lib/admin/            Signed sessions, review queue, dashboard, brief export
src/lib/db/               Drizzle schema + client
src/lib/ingest/           RSS and HTML adapters, cleaning, chunking, upserts
src/lib/llm/              Fail-closed OpenRouter client, prompts, budget
src/lib/locale/           HMAC IP hashing, geo headers, location precedence
src/lib/pipeline/         Extraction, synthesis, orchestration, events
src/lib/referrals/        Action and hotline library
src/lib/registry/         Source/region/referral schemas + loaders
src/lib/retrieval/        IDF-weighted full-text search
src/lib/trust/            Answer/claim types and the freshness gate
data/regions/             Nigeria (36 + FCT) and Kenya (47 counties)
data/sources/             Source registries with tiers, licenses, health
data/referrals/           Verified and clearly-labelled contact pathways
drizzle/                  Generated SQL migrations
scripts/                  Seed, ingestion, ask, eval, red-team
docs/                     Plan, methodology, threat model, constraints, future work
```

## Privacy posture

- `claims` stores de-identified input and has **no join keys** to any identifier.
- IPs are only ever `HMAC-SHA256(IP_HASH_SECRET, ip)` for rate limits and locale hints; raw IPs are never stored or logged.
- LLM routing is hardcoded to zero-retention, no-training endpoints. If none is available the request fails closed rather than degrading.
- Aggregated `events` are k≥3 and represent verification demand, not confirmed incidents.

See [docs/PLAN.md](docs/PLAN.md) for the full trust model and the retention tradeoff.
