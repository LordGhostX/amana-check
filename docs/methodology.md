# Amana Check — methodology

This document describes exactly how Amana Check turns a message into a sourced answer, and what it refuses to do.

## Summary

Amana Check is a retrieval-first verification tool. A language model understands the message and writes the answer, but it never decides what is true. Sources are ingested into Postgres, ranked deterministically, evaluated against freshness and source-strength rules, and the model may only phrase what the evidence supports, with citations the server validates.

## Ingestion

- Sources live in `data/sources/nigeria.yml` and `data/sources/kenya.yml` with publisher, type, tier, scope, fetch kind, URL, license, and enabled state.
- `bun run ingest` fetches every enabled source (RSS today), converts HTML to text, chunks the text into roughly 900-character windows with 150-character overlap, and writes documents, chunks, and hashes.
- Re-ingesting unchanged content only refreshes `fetched_at`. Changed content creates a `document_versions` snapshot and increments the document version, so answers can point at the version of a source that was current when the check ran.
- Source health is tracked with `last_fetch_at`, `last_success_at`, and `consecutive_failures`, and every run is recorded in `ingestion_runs`.
- The live app never fetches the web. Ingestion is the only component that talks to publishers, which removes SSRF risk from the request path.

## Source tiers

| Tier | Kind                     | Examples                                                                        |
| ---- | ------------------------ | ------------------------------------------------------------------------------- |
| T1   | Official primary         | NCDC, NEMA, INEC, Nigeria Police, Kenya MOH, NDMA, state and county governments |
| T2   | Independent verification | Dubawa, FactCheckHub, PesaCheck, Africa Check, UN OCHA ReliefWeb                |
| T3   | Credible media           | Established newsrooms, used as supporting evidence only                         |

T1 alone can support a verdict. Contested claims can also reach a verdict with two independent T2 publishers. T3 never decides alone.

## Retrieval

1. Tokenize the query into lowercase alphanumeric terms of three or more characters, capped at 16.
2. Build an OR tsquery so natural-language queries do not require every term to appear.
3. Fetch candidate chunks with Postgres full-text search and `ts_rank`.
4. Weight term coverage by inverse document frequency, so rare terms (Garissa, Benue, cholera) dominate generic ones (Kenya, county).
5. Reject candidates below an IDF-weighted coverage floor of 0.3, or with fewer than two matched terms on queries of three or more terms. This is what prevents an off-topic official article from counting as evidence.
6. Score the survivors: relevance (weight 3) plus locality (1.2), source tier (0.5), and recency (0.6). Relevance dominates, so tier and freshness can never promote an off-topic document.
7. Return the top eight chunks with page and anchor information.

## Evidence gate

The gate decides the status before any prose is written.

| Claim type                | Freshness window | A verdict requires       |
| ------------------------- | ---------------- | ------------------------ |
| Security incident         | 2 hours          | 1×T1 or 2 independent T2 |
| Flood or weather          | 6 hours          | 1×T1                     |
| Health outbreak           | 24 hours         | 1×T1 or 2×T2             |
| Payment or service scam   | 72 hours         | 1×T1 or 1×T2             |
| Civic process or deadline | 7 days           | 1×T1                     |
| Reference information     | 30 days          | 1×T1 or 1×T2             |

Outcomes are `verified`, `developing`, `unverified`, `not_confirmed_stale`, and `unknown_coverage`. Absence of evidence is never treated as evidence of safety: when the corpus is fresh but silent, the answer says the claim is not confirmed either way, and when the nearest evidence is older than the window, the answer explicitly warns against reading it as safe.

## Synthesis and citation enforcement

- The model receives the fixed status and reason, the user's message, numbered evidence excerpts, and a short list of referral contacts.
- It must answer in the detected language and may only phrase what the evidence supports. Every factual bullet must end with `[S#]` markers.
- The server parses every citation reference, rejects any that do not point at a provided excerpt, and requires at least one cited bullet whenever the status is verified or developing.
- On a rejected response the model gets one repair attempt with the rejection reason. If it fails again, Amana returns a deterministic extractive answer: direct excerpts with citations, plus a notice that no synthesis was produced.

## Language handling

- One model call detects the language, translates the claim into an English search query, extracts keywords and location hints, and classifies the claim type and sensitivity.
- The reply is written in the detected language. English, Nigerian Pidgin, and Swahili are strongest; Yoruba, Igbo, and Hausa are machine-generated and labelled as such in the interface.
- Location precedence is: explicit place in the claim, then the user's selection, then a first-party cookie, then Vercel geo headers, then the national default. Geo only narrows the corpus and never decides language.

## Caching and versioning

- Claims are hashed from the normalized English query, claim type, and country. Answers are cached per claim and language.
- Corrections and re-checks create new `answer_versions` rows with a reason, so the interface can show history and tell returning visitors that an answer changed without any identity being stored.

## Evaluation

- `bun run eval` runs Nigeria and Kenya claim sets through the full pipeline and writes `eval/results/latest.json`.
- Metrics include claim-type accuracy, language detection accuracy, evidence coverage, citation coverage, status refusals, and total cost.
- Latest run: 14/14 claims passed, claim type 13/13, language detection 7/7, cost about $0.018.

## Cost and abuse controls

- Fixed-window rate limiting keyed by HMAC(ip), 20 checks per hour per connection hash.
- A daily cost guard stops the ask endpoint with a 503 once `DAILY_COST_LIMIT_USD` is reached.
- Every model call is logged in `llm_calls` with tokens, model, cost, and success, without prompt or completion content.

## Reproducing

```bash
bun install
createdb amana_check
cp .env.example .env
bun run db:migrate
bun run db:seed
bun run ingest
bun run ask "NEMA has issued a flood alert for Benue State" --ng --fresh
bun run eval
bun run red-team
```
