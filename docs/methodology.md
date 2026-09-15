# Amana Check: methodology

This document describes how Amana Check turns a message into a sourced answer, and what it refuses to do.

## Summary

Amana Check is retrieval-first. A language model reads the message and writes the answer, but it does not decide what is true. Sources are ingested into Postgres, ranked with a deterministic score, and checked against freshness and source-strength rules. The model may only phrase what the evidence supports, with citations the server validates.

## Ingestion

- Sources live in `data/sources/nigeria.yml` and `data/sources/kenya.yml`. Each entry has a publisher, type, tier, scope, fetch kind, URL, license, enabled state, and adapter configuration: link pattern or list selector, content and title selectors, item cap, and timeout. WordPress publishers can use the JSON API adapter when their public RSS endpoint is blocked or unavailable.
- `bun run ingest` fetches every enabled source through the RSS, HTML, or JSON API adapter. Sources are shuffled for each run and processed with up to four workers, while each source keeps its own article requests in order. The RSS adapter parses feeds and item HTML. The HTML adapter runs in listing mode, where it follows links that match the configured pattern and writes each article after it is fetched, or in snapshot mode, where it stores one page as a versioned document. The JSON API adapter parses WordPress posts and uses their rendered content. The Kenya Met weather warnings page uses snapshot mode because the warning list changes in place.
- Text is split into windows of about 900 characters with 150 characters of overlap. Each document stores a SHA-256 content hash.
- Re-ingesting unchanged content refreshes `fetched_at` only. Changed content adds a `document_versions` snapshot and increments the document version, so an answer can point at the source version that was current when the check ran.
- Every document write is its own transaction, including its chunks and any previous version snapshot. A run can therefore leave useful documents in the corpus if a later source fails or the function reaches its time limit; the next run reconciles those documents by their stable source-and-URL ID.
- Source health is tracked with `last_fetch_at`, `last_success_at`, `consecutive_failures`, and `zero_yield_streak`. The zero-yield streak counts successful runs that produced no documents, and it appears in the admin Sources view.
- Scheduled runs use a Postgres advisory lock over the direct `DATABASE_URL_UNPOOLED` session, so two full-corpus invocations cannot process the same set of sources at once. The summary includes `durationMs`, and a run that finds the lock held returns a skipped status for the next scheduled slot to pick up.
- Seeding treats the registry files as the source of truth. A source removed from a YAML file is deleted from the database, and its documents are deleted with it.
- The live app never fetches the web. Ingestion is the only component that talks to publishers, so the request path has no SSRF surface.

The ingestion client uses an honest user agent and fixed arguments. If a publisher answers with a bot block (HTTP 202 with an empty body, HTTP 406, or a page that says bot activity is blocked), the client retries once through `curl`. Incomplete TLS certificate chains take the same path because Bun rejects them while curl resolves them. Transient network errors and HTTP 5xx responses get one retry. If curl is missing or the fallback is disabled with `INGEST_CURL_FALLBACK=0`, the source fails and the failure is recorded.

## Source tiers

| Tier | Kind                     | Examples                                                                                                                                                                                                          |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Official primary         | Nigeria: NCDC, NEMA, INEC, News Agency of Nigeria, State House Nigeria. Kenya: Kenya News Agency, Office of the President, KEMRI, NEMA, NDMA, KALRO, Ministry of Health, National Police Service, Kenya Met, IEBC |
| T2   | Independent verification | Nigeria: Dubawa, FactCheckHub, PesaCheck, ReliefWeb, The New Humanitarian. Kenya: ReliefWeb, Kenya Red Cross, PesaCheck, The New Humanitarian                                                                     |
| T3   | Credible media           | Nigeria: Premium Times, Guardian Nigeria, Daily Trust, The Punch, Nigeria Health Watch. Kenya: The Standard, KBC, Capital FM                                                                                      |

T1 alone can support a verdict. A contested claim can also reach a verdict with two independent T2 publishers. T3 never decides alone.

## Retrieval

1. Split the query into lowercase alphanumeric terms of three or more characters, capped at 16.
2. Build an OR tsquery so a natural-language query does not need every term to appear.
3. Fetch candidate chunks with Postgres full-text search and `ts_rank`.
4. Weight term coverage by inverse document frequency, so rare terms such as Garissa, Benue, or cholera count more than common terms such as Kenya or county.
5. Reject candidates below an IDF-weighted coverage floor of 0.3, or with fewer than two matched terms on queries of three or more terms. This keeps an off-topic official article from counting as evidence.
6. Score the survivors: relevance (weight 3) plus locality (1.2), source tier (0.5), and recency (0.6). Relevance dominates, so tier and freshness cannot promote an off-topic document.
7. Keep the highest-ranked matching chunk from each document before the candidate limit, score those survivors, then return up to eight distinct documents with their source metadata.

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

Outcomes are `verified`, `developing`, `unverified`, `not_confirmed_stale`, and `unknown_coverage`.

A missing source is never treated as evidence of safety. When the corpus is fresh but silent, the answer says the claim is neither confirmed nor denied. When the nearest evidence is older than the window, the answer warns against reading it as safe.

One more rule applies before a verdict is accepted. If the claim names a place and none of the retrieved evidence mentions that place, a verified verdict stops at `developing` with a reason that says so. National coverage cannot verify a claim about a village that no source mentions.

## Synthesis and citation enforcement

- The model receives the fixed status and reason, the user's message, numbered evidence excerpts, and referral contacts that match the claim type.
- It answers in the detected language. Every factual bullet must end with `[S#]` markers.
- The server parses every citation, rejects any reference that does not point at a provided excerpt, and requires at least one cited bullet whenever the status is verified or developing.
- A rejected response gets one repair attempt with the rejection reason. If it fails again, Amana returns an extractive answer built from direct excerpts with citations, plus a notice that no synthesis was produced.

## Model context budget

The model never receives the corpus. It sees two small payloads:

- Call 1 receives only the user's message, capped at 4,000 characters. No source text is included.
- Retrieval runs in Postgres and returns the highest-ranked matching chunk from at most 24 distinct documents; those candidates are scored and trimmed to 8 excerpts.
- Call 2 receives the claim, the status and reason fixed by the gate, up to three referral contacts, and those 8 excerpts. Each excerpt is capped at 700 characters, so the evidence block is at most about 5.6 KB. When retrieval returns nothing, the block reads `EVIDENCE: none found.`

Evidence selection and the status decision stay deterministic. The model only phrases what the retrieved excerpts support, and the server validates every citation against them.

## Language handling

- One model call detects the language, translates the claim into an English search query, extracts keywords and location hints, and classifies the claim type and sensitivity.
- The reply is written in the detected language. English, Nigerian Pidgin, and Swahili are the strongest. Yoruba, Igbo, and Hausa are machine-generated and carry a machine-translation label in the interface.
- Location precedence is: a place named in the claim, then the user's selection, then a first-party cookie, then Vercel geo headers, then the national default. Geo only narrows the corpus. It never decides language.
- No language preference is stored. Each message is detected on its own and the interface is English with browser translation.

## Caching and versioning

- A request is hashed from its normalized original text, country, and region before any model call. An unreviewed answer produced from fallback extraction is stored for feedback and review but skipped on the next cache lookup, so extraction is retried.
- Corrections and re-checks add `answer_versions` rows with a reason. The interface can show that history and tell a returning visitor an answer changed, without storing an identity.

## Evaluation

- `bun run eval` runs the Nigeria and Kenya claim sets through the full pipeline and writes `eval/results/latest.json`.
- Metrics are claim-type accuracy, language detection accuracy, evidence coverage, citation coverage, status distribution, and cost.
- Run of 2026-09-11: 14 of 14 claims passed, claim type 13 of 13, language detection 7 of 7, evidence coverage 1 of 1 applicable expectation, citation coverage 4 of 4 applicable answers, no errors, $0.032018.

## Cost and abuse controls

- Fixed-window rate limiting keyed by HMAC(ip), 20 checks per hour per connection hash.
- A daily cost guard returns HTTP 503 from the ask endpoint once `DAILY_COST_LIMIT_USD` is reached. The default is $5.
- Every model call is logged in `llm_calls` with tokens, model, cost, and success. Prompt and completion content are not logged.

## Referral contacts

A number is added only when it appears on the organisation's own official page. The `verifiedAt` date records the day that page was checked, and the interface labels anything without a date as not yet independently verified. The model never invents contacts, and it receives only the seeded pathways that match the claim type. Outstanding verification tasks are listed in [future-directions.md](future-directions.md).

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
