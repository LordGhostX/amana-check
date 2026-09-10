# Amana Check — frozen plan

**Tagline:** Check before you share.

A community-facing trust layer for fragile information environments. A rumor or question arrives in any language; Amana answers in that same language with what is actually known — sourced, dated, and actionable — and feeds local peacebuilders an anonymous, aggregated signal of verification demand that exposes no one.

**Hackathon:** OSF × Andela "Information you can trust". Cross-track — primary Stability & Social Cohesion, secondary Transparency & Accountability, Safety via referral pathways only. Pull-side complement to analyst-facing listening tools.

## Decision ledger

| Area                | Decision                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Regions             | Nigeria (36 states + FCT) and Kenya (47 counties); geo **suggests** the corpus pack                              |
| Location precedence | explicit location in claim > user-selected > cookie > Vercel region > national                                   |
| UI                  | English only, browser-translatable; answer content in the detected language                                      |
| Language            | any input → detect → translate to English for search → answer back; fallback English                             |
| Model               | OpenRouter with an ordered fallback chain, default `deepseek/deepseek-v4.1-flash` → `deepseek/deepseek-v4-flash` |
| Privacy invariants  | hardcoded `zdr: true`, `data_collection: "deny"`, `require_parameters: true`; **fail closed**                    |
| Retrieval           | Postgres FTS + `pg_trgm` + deterministic scoring; no aliases, no fact cards, no LLM reranker                     |
| Pipeline            | two model calls, Zod validation on both, retry once, deterministic safe fallback                                 |
| Sourcing            | ingestion pipeline only; runtime never touches the web                                                           |
| IP handling         | `HMAC-SHA256(IP_HASH_SECRET, ip)`; `locale_hints` (30d TTL) + `rate_limits` (short TTL), both isolated           |
| Retention           | all inputs persisted indefinitely, de-identified and unlinked                                                    |
| Delivery            | responsive website; offline/PWA/SMS/USSD documented as future direction                                          |

## Retention tradeoff (deliberate)

Inputs are stored unredacted and unlinked. "Unlinked" is **not** "non-identifying": message text can contain names, locations, and personal details. Guardrails built in:

- No join key connects `claims` to `locale_hints`, `rate_limits`, or anything else.
- Admin-only access, no bulk export.
- Claims are never surfaced to other users; only aggregated `events` rows (k≥3).
- In-app notice: "Checks may be stored without your identity to improve Amana."
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

Zod pipeline on every response: `JSON.parse → Zod → semantic checks → accept`. On failure: retry once, then deterministic extractive answer from top evidence or a safe "cannot process" message. If no ZDR-compliant endpoint exists, the call throws `NoCompliantProviderError` and the request **fails closed** — it is never silently routed through a retaining provider. Prompt and completion content is never logged.

## Freshness gate

| Claim type                    | Window | Definitive verdict requires |
| ----------------------------- | ------ | --------------------------- |
| Security incident             | 2h     | 1×T1 or 2× independent T2   |
| Flood / weather               | 6h     | 1×T1                        |
| Health outbreak               | 24h    | 1×T1 or 2×T2                |
| Payment / service scam        | 72h    | 1×T1 or 1×T2                |
| Civic process / deadlines     | 7d     | 1×T1                        |
| Reference (rights, documents) | 30d    | 1×T1/T2                     |

Outcomes: **Verified** · **Developing** · **Unverified** (fresh corpus, no supporting evidence — not true, not false, with local verification steps) · **Not confirmed — evidence too old** ("do not interpret this as safe") · **Unknown coverage**. Database silence is never turned into reassurance.

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

`regions` · `sources` (`refresh_interval`, fetch health) · `documents` · `document_chunks` (tsvector, page/anchor) · `document_versions` · `ingestion_runs` · `claims` (de-identified, no join keys) · `answers` + `answer_versions` · `referrals` · `events` (aggregate only) · `feedback` · `locale_hints` · `rate_limits` · `llm_calls`.

## Phases

| Phase                  | Scope                                                                                                                        | Done when                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Foundation          | Scaffold, Postgres + Drizzle migrations, source registries, `hashIp()`, fail-closed LLM client                               | Migrations apply; registry seeds; fail-closed path tested        |
| 2. Trust Engine        | Ingestion adapters, chunks + FTS + pg_trgm, Call 1 + Zod, deterministic scoring, freshness gate, Call 2 + citations, eval v1 | 100% citation coverage; gate refuses stale verdicts; eval passes |
| 3. Citizen Experience  | Home, check/ask, answer card, source/excerpt view, share, client-side version history, geo precedence                        | End-to-end in six languages + one unseen                         |
| 4. Accountability Loop | Review queue, corrections/versioning, k≥3 dashboard, referrals, brief export                                                 | A correction reaches re-checkers                                 |
| 5. Hardening           | Red-team (injection, privacy, do-no-harm), threat model, rate/cost controls, future-directions doc                           | Documented results; retention tradeoff recorded                  |
| 6. Submission          | README + constraints matrix + methodology, video, deck, summary                                                              | All five artifacts complete                                      |

## Demo target

Paste a messy forwarded Hausa message with no setup → **Not confirmed** answer card with official evidence and anti-scam steps → share → peacebuilder view showing "cash-transfer claims ↑" with the aggregated-verification-demand disclaimer → a source correction lands → re-check shows **Updated since you checked** with version history.

## Known limitations

- Stored content can self-identify despite being unlinked.
- Ingestion schedule is deferred; adapters and registry are built first.
- Yoruba/Igbo/Hausa machine output is labeled, glossary-guided, and native review remains future work.
- Keyword-FTS recall is measured by the eval harness, never papered over.
