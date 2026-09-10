# Amana Check — threat model

This threat model covers the people who use Amana Check, the communities it reports on, and the operators who run it. It follows a do-no-harm posture: the system would rather refuse to answer than expose someone or inflate certainty.

## System summary

- A website and JSON API for checking claims, plus an authenticated review console for a small operator team.
- Inputs: message text in any language (typed or pasted). No accounts, no uploads, no location sharing.
- Data: a curated source corpus; de-identified checks; aggregate verification-demand buckets; an isolated HMAC-keyed rate-limit table.
- Model calls go to OpenRouter with hardcoded zero-retention and no-training routing; the request fails closed if no compliant endpoint exists.
- Ingestion fetches only URLs from the curated registry. The curl fallback for bot-blocked feeds uses a fixed argument array, never a shell, so no user input can reach a command.

## Assets

1. User safety: the fact that someone asked a question must not be linkable back to them.
2. Community safety: answers must not amplify rumors, inflame tensions, or name private individuals.
3. Trust: citations, statuses, freshness, and corrections must be accurate and inspectable.
4. Corpus integrity: sources must not be poisoned or spoofed.
5. Operator access: the review console and its corrections.
6. Budget and availability: model spend and rate limits.

## Actors

- A person checking a forwarded message, possibly on a shared or monitored device.
- A peacebuilder or reviewer reading aggregate demand.
- A malicious user attempting to extract data, forge authority, or burn budget.
- A hostile observer attempting to identify who checked what.
- A source that publishes wrong or manipulative information.
- A model provider, which may have divergent data-retention practices.

## Threats and mitigations

| #   | Threat                                                | Mitigation                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Identifying a user from network metadata              | Raw IPs are never stored or logged. Only `HMAC-SHA256(IP_HASH_SECRET, ip)` is stored, in the isolated `rate_limits` table, which has no foreign key to `claims` and retains rows for one day. The red-team suite asserts that `claims` has no identifier columns and that nothing references it.                                        |
| T2  | Content self-identification                           | Checks are stored de-identified and unlinked, but content can still name people or places. Access is admin-only, there is no bulk export of checks, the aggregate dashboard contains no free text, and the retention tradeoff is documented publicly. Residual risk remains and is acknowledged.                                        |
| T3  | Provider retention or training on prompts             | Every request hardcodes `zdr: true` and `data_collection: "deny"`. If no compliant endpoint exists, the call raises and the request fails closed; it never silently degrades to a retaining provider. Prompt and completion content is never logged.                                                                                    |
| T4  | Prompt injection embedded in a claim                  | User text is treated as untrusted data. The status is decided before generation by the deterministic gate and cannot be changed by the model. Citations are validated server-side, forged references are rejected, and the answer falls back to extracts after one repair attempt. Live injection tests are part of the red-team suite. |
| T5  | Stale data causing harm                               | Freshness windows are enforced per claim type before synthesis. Stale evidence produces `not_confirmed_stale` with explicit “do not treat this as safe” language.                                                                                                                                                                       |
| T6  | False authority from fluent phrasing                  | Answers carry status labels, status reasons, citations with publisher and dates, machine-translation labels, and a methodology page. “Unknown” is a valid answer and absence of evidence is never presented as reassurance.                                                                                                             |
| T7  | Dashboard used as surveillance or as an incident feed | The dashboard is aggregated only, suppresses buckets below three checks, excludes free text and identifiers, and carries a fixed disclaimer that it measures verification demand, not confirmed incidents.                                                                                                                              |
| T8  | Admin takeover                                        | Passcode login is timing-safe, rate limited to ten attempts per fifteen minutes, and issues an HttpOnly, SameSite=Lax, HMAC-signed session token with an eight-hour expiry that is Secure in production. Forged and expired tokens are rejected in tests.                                                                               |
| T9  | Cost or availability abuse                            | Fixed-window rate limiting per HMAC(ip), a daily spend guard that returns 503 when the budget is reached, capped input length, and bounded model tokens.                                                                                                                                                                                |
| T10 | Corpus poisoning                                      | Only curated registry sources are ingested. User content never enters the corpus. Tiers constrain what can support a verdict, high-stakes claims route to human review, and the queue allows corrections with version history.                                                                                                          |
| T11 | HTML or script injection through claims               | Inputs are Zod-bounded, generated text is validated, React escapes all rendering, and no `dangerouslySetInnerHTML` is used anywhere. The red-team suite asserts that script tags cannot survive synthesis.                                                                                                                              |
| T12 | Harm from wrong referral numbers                      | Referrals are seeded from official pages with verification dates. Unverified numbers are labelled “confirm locally” in the interface and in model output, and the model is instructed never to invent contacts.                                                                                                                         |
| T13 | Linkage between rate limiting and content             | Rate-limit rows carry only the HMAC hash and a time bucket. They are never joined to claims, and cleanup removes expired rows during ingestion.                                                                                                                                                                                         |

## Do-no-harm rules

- Never publish an unverified accusation naming a person or group.
- Never treat silence as safety, and never turn database age into reassurance.
- Never invent contacts, fees, or links.
- Never let the model set or override a verification status.
- Never expose one user's question to another user.
- Never store raw network identifiers.
- Prefer refusal and extracts over speculation.

## Residual risks

- Stored check text can self-identify even though it is unlinked. This is a deliberate research-value tradeoff; the written summary must not claim anonymity for stored content.
- The HMAC secret protects IP pseudonymity; if it leaks, hashes for a known IP range could be reproduced.
- Model output in Yoruba, Igbo, and Hausa is machine-generated and may contain errors; it is labelled but not yet natively reviewed.
- Coverage gaps are real: a thin corpus produces frequent honest refusals, which may frustrate users who expect an answer.
- Referral numbers can change without notice; verification dates mitigate but do not eliminate this.
- Source publishers can be wrong even at T1; Amana reports what sources say, not ground truth.

## Kill switches and incident response

- Disable a source by setting `enabled: false` in its registry and re-seeding.
- Stop all model spend by setting `DAILY_COST_LIMIT_USD=0` and restarting, or by removing the OpenRouter key.
- Purge the check corpus with `DELETE FROM claims;` if retention policy changes.
- Rotate `IP_HASH_SECRET` to invalidate all rate-limit keys and admin sessions; rotate `ADMIN_PASSCODE` to revoke operator access.
- Revoke a published answer by correcting it in the review console, which creates a new version that re-checkers will see.
