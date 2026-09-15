# Amana Check: future directions

These items sit outside the proof of concept. Each one states what exists now and what would change.

## Reach beyond the website

SMS shortcode. The pipeline can answer over SMS with menu-driven replies: a short status line, then "reply 1 for sources, 2 for next steps, 3 for contacts". Replies would cap at 300 characters over two GSM-7 segments. The formatter would strip optional diacritics, because Yoruba and Hausa push messages into UCS-2. Africa's Talking covers Nigeria and Kenya and exposes the webhook shape the `/api/ask` handler already uses. The missing pieces are shortcode registration and the formatter.

USSD menu. A free menu for feature phones. The user picks a claim topic and gets a short status and a callback number, with no data connection.

WhatsApp Business API. Most rumors travel on WhatsApp. A user could forward a message to the Amana number and receive the answer card, with a share-back format that keeps the sources attached. This needs business verification and template approval.

Offline access. A service worker could cache the last region pack and recent answers so a check returns something useful with no network, labelled with its sync time. The current build works on slow connections but does not cache.

Interactive voice response. For users who cannot read or have no screen: record a question, transcribe it, answer it, and read the answer back in the detected language.

## Language quality

Native-speaker review. Yoruba, Igbo, and Hausa output is machine-generated and labelled. The next step is a review workflow where native speakers score and correct translations, with corrections feeding the review queue and a glossary of civic terms.

More languages. The pipeline is language-agnostic. French, Portuguese, Arabic, Amharic, Somali, Lingala, and Zulu would extend coverage toward the Sahel, DRC, Mozambique, and Sudan.

Curated civic glossary. Short reviewed term lists per language for words such as curfew, IDP camp, palliative, and outbreak. The lists would keep machine output consistent on high-stakes vocabulary.

## Coverage and data

Per-source ingestion schedules. Production currently runs the full corpus every three hours through Vercel Cron. The existing `refresh_interval` fields could later let a worker refresh priority feeds more often, leave slower sources on the three-hour cadence, and reserve daily work for PDFs without increasing every source's request load.

PDF adapter. The HTML adapter serves NCDC, INEC, IEBC, and Kenya Met. A PDF adapter would make situation reports available when they are published only as PDFs.

Approved ReliefWeb appname. Request an appname at apidoc.reliefweb.int, implement the `api` fetch kind with country filters, and retire the curl fallback that the country feeds currently need.

Bot-friendly humanitarian feeds. The New Humanitarian is wired in with country keyword filters. PesaCheck and IPC are still blocked, which leaves the independent-verification tier thin for Kenya in particular.

Semantic retrieval. Postgres full-text search is deterministic and inspectable. A pgvector index with a multilingual embedding model would improve recall on paraphrases while keeping the same evidence gate and citation rules.

More official sources. Kenya MOH, Kenya Met, NDMA, and NEMA are ingested. State emergency agencies and county governments in Kenya would deepen T1 coverage.

## Trust and accountability

Correction push. A returning visitor sees "updated since you checked" from local storage. A privacy-preserving version could let a user opt into a one-time correction code shown with the answer, with no account.

Public changelog. A page listing corrections, disabled sources, and prompt-version changes would make the trust posture auditable.

Source dispute process. A published pathway for publishers to challenge how their material was used, with review and versioned outcomes.

Verification partnerships. Local fact-checkers and peacebuilding organisations could contribute verification through the review console, with attribution stored on versions.

## Referral verification backlog

These pathways were not publishable because their official pages were unreachable or did not list a number. Verify them before adding, and re-check every seeded referral on a rolling cadence.

- NAPTIP trafficking hotline (Nigeria). The official site timed out repeatedly.
- Kenya national GBV hotline 1195. Not listed on the State Department for Gender homepage. Confirm with the ministry or a designated service provider.
- Kenya Ministry of Health public hotline 719. Not confirmed from an official page.
- Rolling re-verification. Check every seeded referral quarterly and update `verifiedAt`, or clear the date so the interface stops presenting it as verified.

## Blocked publishers

These publishers were removed from the registry because every non-browser client we use is refused, and the project does not spoof browsers. Revisit them only with publisher permission or an approved API.

- HumAngle (Nigeria). HTTP 429 to Bun and curl. Only a full browser user agent passes.
- Africa Check. HTTP 403 to curl and Bun.
- Nation Media Group (Kenya). HTTP 403 to curl and Bun.
- Nigeria Police Force website. HTTP 429 to curl and Bun. The 112 and WhatsApp pathways remain available as seeded referrals.
- NiMet (Nigeria). Site paths redirect to `/error/404.html`. No working feed or listing.

## Expansion and operations

New geographies. The region, source, and referral packs are country-scoped. Sahel (Mali, Burkina Faso, Niger), DRC, Mozambique, and Sudan are the next packs for OSF's Transformative Peace focus.

Per-country budgets and observability. Daily cost caps exist globally. Per-country caps and dashboards for ingestion health, refusal rates, and answer latency would make operations routine.

Backups and retention policy. Neon point-in-time recovery plus an explicit retention schedule for the check corpus, consistent with the privacy policy.

Evaluation expansion. The eval harness has 14 claims. Growing it to 100 or more per country, including adversarial and multilingual cases, is the most direct way to keep quality visible.
