# Amana Check: threat model

This threat model covers the people who use Amana Check, the communities it reports on, and the operators who run it. The posture is do-no-harm: the system would rather refuse to answer than expose someone or inflate certainty.

## System summary

- A website and JSON API for checking claims, plus an authenticated review console for a small operator team.
- Inputs are message text in any language, typed or pasted. There are no accounts, uploads, or location sharing.
- Data includes a curated source corpus, de-identified checks, aggregate verification-demand buckets, and an isolated HMAC-keyed rate-limit table.
- Model calls use OpenRouter first, or Vercel AI Gateway when the OpenRouter key is blank. Both request zero-retention and no-training routing; Gateway can retry without zero-retention when the current plan rejects that option.
- Ingestion fetches only URLs from the curated registry. The curl fallback uses a fixed argument array and never a shell, so user input cannot reach a command.

## Assets

1. User safety. A check must not be linkable back to the person who made it.
2. Community safety. Answers must not amplify rumors, inflame tensions, or name private individuals.
3. Trust. Citations, statuses, freshness, and corrections must be accurate and inspectable.
4. Corpus integrity. Sources must not be poisoned or spoofed.
5. Operator access. The review console and its corrections.
6. Budget and availability. Model spend and rate limits.

## Actors

- A person checking a forwarded message, possibly on a shared or monitored device.
- A peacebuilder or reviewer reading aggregate demand.
- A malicious user trying to extract data, forge authority, or burn budget.
- A hostile observer trying to identify who checked what.
- A source that publishes wrong or manipulative information.
- A model provider with its own data-retention practices.

## Threats and mitigations

| #   | Threat                                                | Mitigation                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Identifying a user from network metadata              | Raw IPs are never stored or logged. Only `HMAC-SHA256(APP_SECRET, ip)` is stored, in the isolated `rate_limits` table, which has no foreign key to `claims` and keeps rows for one day. The red-team suite asserts that `claims` has no identifier columns and that nothing references it.                                                                                               |
| T2  | Content self-identification                           | Checks are stored de-identified and unlinked, but content can still name people or places. Access is admin-only, there is no bulk export of checks, the dashboard contains no free text, and the retention tradeoff is documented. The residual risk stays.                                                                                                                              |
| T3  | Provider retention or training on prompts             | OpenRouter requests hardcode `zdr: true` and `data_collection: "deny"`; AI Gateway requests set `zeroDataRetention: true` and `disallowPromptTraining: true`. If Gateway rejects zero-retention because of the plan, it retries without that flag while retaining the no-training request. Other provider failures still fail closed, and prompt and completion content is never logged. |
| T4  | Prompt injection embedded in a claim                  | User text is untrusted data. The status is decided by the deterministic gate before generation and cannot be changed by the model. Citations are validated server-side, forged references are rejected, and a failed answer falls back to extracts after one repair attempt. Live injection tests run in the red-team suite.                                                             |
| T5  | Stale data causing harm                               | Freshness windows are enforced per claim type before synthesis. Stale evidence produces `not_confirmed_stale` with explicit language that says not to read it as safe.                                                                                                                                                                                                                   |
| T6  | False authority from fluent phrasing                  | Answers carry status labels, status reasons, citations with publisher and dates, machine-translation labels, and a link to the methodology. "Unknown" is valid, and a missing source is never presented as reassurance.                                                                                                                                                                  |
| T7  | Dashboard used as surveillance or as an incident feed | The dashboard is aggregate only. It suppresses buckets below three checks, contains no free text or identifiers, and carries a fixed disclaimer that it measures verification demand and not incidents.                                                                                                                                                                                  |
| T8  | Admin takeover                                        | Passcode login is timing-safe, rate limited to ten attempts per fifteen minutes, and refuses the template passcode in production. It issues an HttpOnly, SameSite=Lax, HMAC-signed session token that expires after two hours and is Secure in production. Admin POSTs reject cross-origin requests, and forged or expired tokens are rejected in tests.                                 |
| T9  | Cost or availability abuse                            | Fixed-window rate limiting per HMAC(ip), a daily spend guard that returns HTTP 503 at the budget, capped input length, and bounded model tokens.                                                                                                                                                                                                                                         |
| T10 | Corpus poisoning                                      | Only curated registry sources are ingested, and user content never enters the corpus. Tiers constrain what can support a verdict, high-stakes claims route to human review, and corrections are versioned.                                                                                                                                                                               |
| T11 | HTML or script injection through claims               | Inputs are Zod-bounded, generated text is validated, React escapes rendering, and no component uses `dangerouslySetInnerHTML`. The red-team suite asserts that script tags cannot survive synthesis.                                                                                                                                                                                     |
| T12 | Harm from wrong referral numbers                      | Referrals are seeded from official pages with check dates. Numbers without a date are labelled for local confirmation in the interface and in model output, and the model is instructed not to invent contacts.                                                                                                                                                                          |
| T13 | Linkage between rate limiting and content             | Rate-limit rows carry only the HMAC hash and a time bucket. They are never joined to claims, and ingestion removes expired rows.                                                                                                                                                                                                                                                         |

## Do-no-harm rules

- Do not publish an unverified accusation that names a person or group.
- Do not treat silence as safety, and do not turn database age into reassurance.
- Do not invent contacts, fees, or links.
- The model does not set or override a verification status.
- One user's question is never exposed to another user.
- Raw network identifiers are not stored.
- When evidence is thin, prefer refusal and direct excerpts over speculation.

## Residual risks

- Stored check text can identify the person who wrote it even though it is unlinked. This is a deliberate tradeoff for research value. The written summary must not claim anonymity for stored content.
- The HMAC secret protects IP pseudonymity. If it leaks, hashes for a known IP range can be reproduced.
- Yoruba, Igbo, and Hausa output is machine-generated and may contain errors. It is labelled but not yet reviewed by native speakers.
- Coverage gaps are real. A thin corpus produces honest refusals, and a user who expects an answer may be disappointed.
- Referral numbers change without notice. Check dates reduce the risk but do not remove it.
- A T1 publisher can still be wrong. Amana reports what sources say, not ground truth.

## Kill switches and incident response

- Disable a source by setting `enabled: false` in its registry and re-seeding.
- Stop model spend by setting `DAILY_COST_LIMIT_USD=0` and restarting, or by removing both provider keys.
- Purge the check corpus with `DELETE FROM claims;` if the retention policy changes.
- Rotate `APP_SECRET` to invalidate rate-limit keys and admin sessions. Rotate `ADMIN_PASSCODE` to revoke operator access.
- Revoke a published answer by correcting it in the review console. The correction becomes a new version that returning visitors see.
