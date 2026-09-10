# Amana Check — future directions

These are deliberately out of the proof-of-concept scope, with enough design detail that they can be picked up next. Each item states what exists today and what would change.

## Reach beyond the website

- **SMS shortcode.** The same pipeline can respond over SMS with menu-driven replies: status line first, then “reply 1 for sources, 2 for next steps, 3 for contacts”. Replies cap at 300 characters over two GSM-7 segments, and the formatter strips optional diacritics because Yoruba and Hausa push messages into UCS-2. Africa's Talking already covers Nigeria and Kenya and exposes the exact webhook shape the `/api/ask` handler uses. What is missing is shortcode registration and a formatter layer.
- **USSD menu.** A free-to-the-user menu for feature phones: choose a claim topic, get a short status and a callback number. Works without data and without a smartphone.
- **WhatsApp Business API.** Rumors travel on WhatsApp, so verified answers should too: forward a message to the Amana number and receive the answer card, plus a share-back format with sources attached. Requires business verification and template approval.
- **Offline-first PWA.** Cache the last region pack and recent answers in a service worker so a check still returns something useful with no network, clearly labelled with its sync time. Current design keeps pageloads small but does not cache.
- **Interactive voice response.** For users with low literacy or no screen: record a question, have it transcribed and answered, then read back in the detected language.

## Language quality

- **Native-speaker review.** Yoruba, Igbo, and Hausa output is machine-generated and labelled. The next step is a review workflow where native speakers score and correct translations, with corrections feeding the review queue and a glossary of civic terms.
- **More languages.** The architecture is language-agnostic. French, Portuguese, Arabic, Amharic, Somali, Lingala, and Zulu would extend coverage toward the Sahel, DRC, Mozambique, and Sudan.
- **Curated civic glossary.** Short, reviewed term lists per language (curfew, IDP camp, palliative, outbreak) to stabilise machine output for high-stakes vocabulary.

## Coverage and data

- **Scheduled ingestion.** Per-source `refresh_interval` fields already exist in the registry but no scheduler is wired. GitHub Actions cron or an always-on worker can refresh priority feeds every 15 minutes, the rest hourly, and PDFs daily. The freshness gate already refuses verdicts when runs fail, so scheduling only improves coverage.
- **HTML and PDF adapters.** Several official primaries (NCDC news, Nigeria Police, ministry sites) publish HTML rather than RSS. An HTML listing adapter and a PDF adapter would unlock them.
- **Approved ReliefWeb appname.** Request an appname at apidoc.reliefweb.int, then implement the `api` fetch kind with country filters and retire the curl fallback that country feeds currently require.
- **Bot-friendly humanitarian feeds.** The New Humanitarian is wired in with country keyword filters, but bot-blocked sources such as PesaCheck and IPC still leave the independent-verification tier thinner than it should be, especially in Kenya.
- **Semantic retrieval.** Postgres full-text search is deterministic and inspectable. Adding `pgvector` with a multilingual embedding model would improve recall on paraphrases while keeping the same evidence gate and citation rules.
- **More official sources.** Kenya MOH, Kenya Met, NDMA, and Nigeria's NEMA/state emergency agencies would deepen T1 coverage beyond today's RSS subset.

## Trust and accountability

- **Correction push.** Today a returning visitor sees “updated since you checked” from local storage. A privacy-preserving version could let a user opt into a one-time correction code shown with their answer, without an account.
- **Public changelog.** A page listing corrections, disabled sources, and prompt-version changes so the trust posture is auditable rather than asserted.
- **Source dispute process.** A published pathway for publishers to challenge how their material was used, with review and versioned outcomes.
- **Verification partnerships.** Local fact-checkers and peacebuilding organisations could contribute verification through the review console, with attribution stored on versions.

## Referral verification backlog

The following pathways are valuable but were not publishable during the build because their official pages were unreachable or did not list a number. Verify them before adding, and re-check every seeded referral on a rolling cadence.

- NAPTIP trafficking hotline (Nigeria) — the official site timed out repeatedly during verification.
- Kenya national GBV hotline 1195 — not listed on the State Department for Gender homepage; confirm with the ministry or a designated service provider.
- Kenya Ministry of Health public hotline 719 — not confirmed from an official page.
- Rolling re-verification: check every seeded referral quarterly and update `verifiedAt`, or clear the date so the interface stops presenting it as verified.

## Blocked publishers

These publishers were evaluated and removed from the registry because every non-browser client we use is refused, and the project does not spoof browsers to get around bot protection. Revisit only with publisher permission or an approved API.

- HumAngle (Nigeria) — HTTP 429 to both Bun and curl; only a full browser user agent passes.
- Africa Check — HTTP 403 to curl and Bun.
- Nation Media Group (Kenya) — HTTP 403 to curl and Bun.
- Nigeria Police Force website — HTTP 429 to curl and Bun; its 112 and WhatsApp pathways remain available as seeded referrals.
- NiMet (Nigeria) — site paths redirect to `/error/404.html`; no working feed or listing.

## Expansion and operations

- **New geographies.** The region, source, and referral packs are country-scoped. Sahel (Mali, Burkina Faso, Niger), DRC, Mozambique, and Sudan are the natural next packs given OSF's Transformative Peace focus.
- **Per-country budgets and observability.** Daily cost caps exist globally; per-country caps and dashboards for ingestion health, refusal rates, and answer latency would make operations routine.
- **Backups and retention policy.** Neon point-in-time recovery plus an explicit retention schedule for the check corpus, aligned with the privacy policy.
- **Evaluation expansion.** The eval harness is small and honest. Growing it to 100+ claims per country, including adversarial and multilingual cases, is the cheapest way to keep quality visible.
