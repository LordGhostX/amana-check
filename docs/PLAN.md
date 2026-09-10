# Amana Check: plan

**Tagline:** Check before you share.

Amana Check is a community-facing trust layer for fragile information environments. A rumor or question arrives in any language. Amana answers in the same language with what is actually known, gives a source and a date for each fact, and feeds local peacebuilders an aggregated signal of verification demand.

**Hackathon:** OSF × Andela "Information you can trust". Cross-track. Primary: Stability & Social Cohesion. Secondary: Transparency & Accountability, and Safety through referral pathways only. It serves the pull side, where analyst-facing listening tools serve the push side.

## Decision ledger

| Area                | Decision                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regions             | Nigeria (36 states + FCT) and Kenya (47 counties). Geo suggests the corpus pack, and never decides language.                                                         |
| Location precedence | Explicit location in the claim, then user selection, then cookie, then Vercel region, then national.                                                                 |
| UI                  | English only, browser-translatable. Answer content in the detected language.                                                                                         |
| Language            | Any input is detected, translated into an English query for search, and answered in the original language. Fallback is English.                                      |
| Model               | OpenRouter with an ordered fallback chain: `deepseek/deepseek-v4.1-flash`, then `deepseek/deepseek-v4-flash`.                                                        |
| Privacy invariants  | Hardcoded `zdr: true`, `data_collection: "deny"`, `require_parameters: true`. Fail closed.                                                                           |
| Retrieval           | Postgres FTS and `pg_trgm` with deterministic scoring. No aliases, no fact cards, no LLM reranker.                                                                   |
| Pipeline            | Two model calls, Zod validation on both, one retry, deterministic fallback.                                                                                          |
| Sourcing            | Ingestion pipeline only. The runtime never touches the web.                                                                                                          |
| IP handling         | `HMAC-SHA256(IP_HASH_SECRET, ip)` for rate limiting only. The `locale_hints` table was removed before deployment because language preference storage was not needed. |
| Retention           | All inputs are kept indefinitely, de-identified and unlinked.                                                                                                        |
| Delivery            | Responsive website. Offline, PWA, SMS, and USSD are documented as future directions.                                                                                 |

## Retention tradeoff

Inputs are stored unredacted and unlinked. Unlinked is not the same as non-identifying: message text can contain names, locations, and personal details. The following guardrails are built in:

- No join key connects `claims` to `rate_limits` or anything else.
- Access is admin-only, with no bulk export.
- Claims are never surfaced to other users. Only aggregated `events` rows appear, with a k≥3 floor.
- The interface shows a notice that checks may be stored without identity to improve Amana.
- The written summary must not claim anonymity for stored content.

## Privacy and routing invariants

Every OpenRouter call sends:

```json
{
  "models": ["deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4-flash"],
  "provider": {
    "zdr": true,
    "data_collection": "deny",
    "require_parameters": true
  },
  "response_format": { "type": "json_object" }
}
```

Zod runs on every response: `JSON.parse`, then Zod, then semantic checks, then accept. On failure the call retries once, then falls back to a deterministic extractive answer built from the top evidence, or to a safe message that the check could not be processed. If no ZDR-compliant endpoint exists, the call throws `NoCompliantProviderError` and the request fails closed. It is never routed through a provider that retains prompts. Prompt and completion content are never logged.

## Freshness gate

| Claim type                    | Window | A verdict requires       |
| ----------------------------- | ------ | ------------------------ |
| Security incident             | 2h     | 1×T1 or 2 independent T2 |
| Flood or weather              | 6h     | 1×T1                     |
| Health outbreak               | 24h    | 1×T1 or 2×T2             |
| Payment or service scam       | 72h    | 1×T1 or 1×T2             |
| Civic process or deadline     | 7d     | 1×T1                     |
| Reference (rights, documents) | 30d    | 1×T1 or 1×T2             |

Outcomes are `verified`, `developing`, `unverified`, `not_confirmed_stale`, and `unknown_coverage`. A fresh but silent corpus produces `unverified`, which is neither a confirmation nor a denial, and includes steps for local verification. Evidence older than the window produces `not_confirmed_stale`, which warns that the result is not a statement of safety. Database silence is never treated as reassurance. A verified verdict also stops at `developing` when the claim names a place that no retrieved source mentions.

## Pipeline

```
CALL 1 → { detected_lang, confidence, claim_text, claim_type, sensitivity,
           english_query, keywords[], location_hints[] }

DETERMINISTIC RETRIEVAL
  score = IDF-weighted relevance + locality boost + source-tier boost + freshness boost
  (terms joined with OR; rare terms dominate; off-topic chunks are filtered out)
  → top chunks with page/anchor

CALL 2 → synthesis in detected_lang over top evidence only, strict citation JSON

CACHE by (claim_hash, lang), versioned; "updated since you checked" is computed
client-side and never sent to the server.
```

## Data model

`regions` · `sources` (`refresh_interval`, fetch config and health) · `documents` · `document_chunks` (tsvector, page/anchor) · `document_versions` · `ingestion_runs` · `claims` (de-identified, no join keys) · `answers` + `answer_versions` · `referrals` · `events` (aggregate only) · `feedback` · `rate_limits` · `llm_calls`.

## Phases

Phases 1 through 5 are complete. Phase 6 is in progress.

| Phase                  | Scope                                                                                                                                | Done when                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1. Foundation          | Scaffold, Postgres and Drizzle migrations, source registries, `hashIp()`, fail-closed LLM client                                     | Migrations apply; registry seeds; fail-closed path tested          |
| 2. Trust Engine        | Ingestion adapters, chunks and FTS and pg_trgm, Call 1 and Zod, deterministic scoring, freshness gate, Call 2 and citations, eval v1 | Citation coverage passes; gate refuses stale verdicts; eval passes |
| 3. Citizen Experience  | Home, check and ask, answer card, source view, share, client-side version history, geo precedence                                    | End-to-end in six languages plus one unseen                        |
| 4. Accountability Loop | Review queue, corrections and versioning, k≥3 dashboard, referrals, brief export                                                     | A correction reaches re-checkers                                   |
| 5. Hardening           | Red-team for injection, privacy, and do-no-harm, threat model, rate and cost controls, future-directions doc                         | Documented results; retention tradeoff recorded                    |
| 6. Submission          | README, constraints matrix, methodology, video, deck, summary                                                                        | All five artifacts complete                                        |

## Demo target

A messy forwarded Hausa message is pasted with no setup. The answer comes back not confirmed, with official evidence and anti-scam steps. The user shares it. The peacebuilder view shows cash-transfer checks rising, under a disclaimer that it measures verification demand rather than incidents. A source correction lands, and a re-check shows that the answer changed, with version history.

## Known limitations

- Stored content can identify the person who wrote it even though it is unlinked.
- Ingestion runs on demand. A scheduler is deferred, and the adapters and registry are built.
- Yoruba, Igbo, and Hausa output is machine-generated, label-guided, and not yet reviewed by native speakers.
- Keyword full-text search misses some paraphrases. The eval harness measures recall, and the limitation is not hidden.
