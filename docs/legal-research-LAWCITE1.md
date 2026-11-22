# LAWCITE1 — retrieved authority and paragraph-cited notes

## Scope and reuse decision (2026-11-22)

Capability families C11 (controlled documents/evidence), C19–20 (commands/audit), and C23 (bounded source discovery). Catalog locations have moved from `~/Code/OPENFRONT-FEATURES-*` to `~/Code/openfronts/fleet-docs/OPENFRONT-FEATURES-*`.

Inspected donors: this repo's `features/keystone/models/documents.ts`, `mutations/partyWorkflows.ts`, `mutations/workflow-helpers.ts`, `lib/transactions.ts`, `platform/legal-ai/**`; Restaurant's `features/keystone/utils/paymentProviderAdapter.ts`; commerce and Restaurant dashboard GraphQL clients. Reuse the firm/matter filters, current actor transaction guard, explicit command projections, audit evidence, and platform form/panel system. Adapt the finite provider and fail-closed HTTPS boundary, not the payment interface. Statutes/judgments need their own official numbering and source identity; uploaded document versions do not provide retrieval/search/paragraph citations. Keep legal source policy local; no upstream abstraction or new AI/provider service.

Entry → session permission → accessible matter → read publisher outside transaction → reauthorize current actor and matter inside serializable transaction → immutable source and paragraph records → audit. No user-selected URL is fetched. Provider hosts are fixed, redirects refused, deadline 25 seconds and streamed response budget 8 MiB. No app cookies sent to publishers. CourtListener credentials remain server-only.

## Competitors (public sites fetched 2026-11-22)

- **Venato** — https://venato.ai/ markets EU/UK legislation mapped and updated in real time, answers grounded in source text and exact citations that the lawyer can verify. Public landing page does not expose a working paragraph-citation UI; these are vendor claims, not independently measured accuracy. Useful pattern: exact passage and freshness beside the answer.
- **Ovviously** — https://ovviously.com/ is client-rendered; the readable homepage exposes no meaningful product evidence. Fetched its first-party guide https://www.ovviously.com/tools/source-backed-ai-research-verify-legal-claims-before-advising-clients (updated November 4, 2026). It describes claim-by-claim triage, source links beside answers, refusal to present an unconfirmed source, matter-centred notes, and warns that a link proves existence, not applicability. No independent paragraph-precision/accuracy verification performed.
- **Digibeetle** — https://digibeetle.eu/ describes daily updated European AI/data/privacy case law and supervisory documents, curated by privacy professionals, with filters and document-to-document cross-references. Its public page shows testimonials and a product image, not an inspectable authenticated citation workflow. Useful patterns: curated scope, explicit source coverage, reference navigation and currentness. Do not claim it supplies paragraph-grounded AI answers from this evidence.

Trust requirements derived from those workflows: identifiable publisher/jurisdiction, precise passage, retrieval date and hash, immutable evidence, explicit unsupported statements, and human review of applicability/currentness. A citation in this product means “linked retrieved text,” not entailment, legal correctness, or a citator/negative-treatment check.

## Free US source findings

- **CourtListener / RECAP (Free Law Project)**: https://www.courtlistener.com/api/rest/v4/ and https://wiki.free.law/c/courtlistener/help/api/rest/change-log . Search, opinion/cluster detail and citation lookup all returned 401 anonymously; v3 returned 403. V4.8 documentation extends authentication to remaining endpoints. A free account API token is required. Opinion HTML/plain text includes court wording and sometimes court-printed paragraph numbers; otherwise ordinal extraction paragraphs must be labelled as extraction numbers, not official ¶ numbering. RECAP supplies federal docket/filing records; it is not itself proof of a judgment's official-publication or precedential status. The adapter retrieves opinion text and cluster citations; no fake fallback. Token requested from lead; owner-account creation not attempted.
- **eCFR**: https://www.ecfr.gov/developers/documentation/api/v1 and `/api/search/v1/results`, `/api/versioner/v1/titles.json`, `/api/versioner/v1/full/{date}/title-{n}.xml?section={section}`. Anonymous API works; versioner requires compression. Stores publisher's up-to-date date and official paragraph designations, with current official section URL. eCFR is continuously updated regulatory text, not a claim about statutory authority or historical effective date.
- **US Code / OLRC**: https://uscode.house.gov/download.html offers official USLM XML/XHTML by title and release point, plus prior release points; current page reported Public Law 119-142 (November 10, 2026). USLM supplies section/subsection identifiers. An initial dynamic view URL returned 404; do not present a working integrated adapter on that basis. Not integrated in this slice.
- **govinfo / GPO**: https://www.govinfo.gov/features/api and https://www.govinfo.gov/api-signup document package/granule metadata/content, collections including USCOURTS, and api.data.gov authentication. Useful for publication metadata and official document versions. No key exists for this task, so not represented as configured or integrated.
- **Maine Legislature**: https://legislature.maine.gov/statutes/ provides free section HTML/PDF/DOCX and official title/subsection/letter numbering. HTML exposes extracted-on date and legislative history. Integrated citation lookup reads the official page on attachment, never accepts entered text. History annotations are excluded from operative paragraphs; retrieval metadata remains visible.
- **Maine Judicial Branch**: https://www.courts.maine.gov/courts/sjc/lawcourt/2024/index.html supplies published decisions and PDF links with citations/dates. PDFs have court-printed [¶n] numbering. The court warns that permanent official versions are in the Atlantic Reporter. UI identifies the court-published PDF; do not claim Free Law Project is an official court publisher. Integrated exact citation and recent case-name index search; PDF extraction preserves court ¶ labels.

## Shipped design / limits

`LegalSource` snapshots are unique by matter, publisher, external record and text hash. Changed publisher text creates another snapshot; existing paragraph words and note links never silently change. Each paragraph has record id, official/extraction label, stable anchor and SHA-256. Re-reading identical text returns its existing snapshot. No source is represented as continuously updated.

Research lives at `/dashboard/platform/matters/[matterId]/research`, accessible to document-capable matter staff without granting AI-agent administration permissions. Commands are the only write path. Notes use `[[cite:<retrieved paragraph id>]]`; save checks every id on the same firm/matter, removes unknown ids, audits them and returns a warning. Each uncited sentence is visibly Unsupported. Cited sentences are linked evidence, not automatically validated reasoning. Clicking links opens the source, scrolls to/highlights the exact paragraph, and provides the publisher URL.

No service model key is configured. No AI answer generation has been added. Search is limited to listed sources; this is not a comprehensive case-law citator. First-party competitor material is marketing evidence, not tested product parity.

## Verification before deploy

- Pure parsers exercised against real fetched Maine statute/eCFR/index fixtures; 10 new tests pass.
- Full test suites: 70 + 20 passing; typecheck and lint passing.
- Production Next build passing; dashboard query documents validated against generated GraphQL schema.
- Five-role pre-push live crawl: admin, attorney, paralegal, billing, intake; no 5xx/page exceptions found. Expected role restrictions remain 404.
- Migration generated/applied only against shared scratch. `migrate dev` failed on legacy schema replay; used schema diff from scratch after existing migrations applied, reviewed additive SQL, applied and verified drift exit 0. Additional immutable-snapshot uniqueness migration applied on scratch. Production uses existing `prisma migrate deploy` startup.

Live proof and CourtListener proof remain pending; do not call LAWCITE1 complete until both are recorded.
