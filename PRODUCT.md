# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the repository and the owner's brief of 2026-10-25 (`batches-2-6-full-redesign-2026-10-25.md`), which ordered the work with no approval stage. Facts below are repository evidence, not interview answers.

## Platform

web

## Users
- **Firm staff (operators):** attorneys, paralegals, intake coordinators and billing staff at a small or mid-size firm. They open the dashboard platform pages to clear today's queue: screen and clear intakes for conflicts, open matters, meet deadlines and court dates, record time, issue bills and reconcile trust.
- **Prospective clients:** people with a legal problem looking at the firm's public site to judge whether this firm handles their kind of matter and to ask for a consultation.
- **Existing clients:** sign in to the client portal to see documents, invoices and messages the firm has shared.

## Product Purpose
A self-hostable legal practice and client-collaboration application (Openfront Law Firm). Public visitors explore practice areas and attorneys or request consultations; firm teams manage intake, conflicts, matters, deadlines, documents, communication, time, expenses, billing, trust records and scoped client sharing.

## Operating Context
- Matter numbers (e.g. `2026-001`) are the firm's primary identifier; conflicts, deadlines, docket entries and trust balances hang off matters.
- Work is deadline-driven: court dates, statutes of limitation and docket entries carry real consequences.
- Trust (IOLTA-style) accounting and billing must be exact; amounts are read in columns.
- One shared Openfront dashboard shell (sidebar, header, breadcrumbs) wraps every platform page and is identical across all Openfront products; it is not this product's to change.

## Capabilities and Constraints
- Platform workspaces: Today, Intake & conflicts, Matters, Contacts, Calendar & tasks, Courts & dockets, Documents, Communications, Time & expenses, Billing & payments, Retainers, Trust & accounting, Client portal, Reports, AI, Firm, Team, Governance, Integrations, Data, Public site, Branding.
- Storefront routes: `/`, `/practice-areas`, `/practice-areas/[slug]`, `/attorneys`, `/attorneys/[slug]`, `/about`, `/contact`, `/consultation` (+ payment, received), `/portal` (+ signin, accept, share), `/account`, `/privacy`, `/disclaimer`, `/accessibility`.
- Public legal content must be owner-verified before publication; no practice areas, attorney credentials or response promises are bundled as firm facts. The anonymous intake form stays closed unless the firm publishes a public-site policy.

## Brand Commitments
- The firm's name and logo come from the firm's own settings (demo: Harbor & Pine). Openfront branding stays in the shared shell only.
- Required legal notices stay visible: no legal advice or attorney-client relationship; not for emergencies or deadline protection.

## Evidence on Hand
- Demo data (2026-10-25): firm Harbor & Pine, one office, one open matter, storefront unpublished. No photography, testimonials, case results or attorney bios are bundled; none may be invented.

## Product Principles
- The operator's next obligation (deadline, conflict, unbilled time, trust balance) is visible before anything else.
- Exactness over decoration: numbers, dates and matter numbers are read in aligned columns.
- Public pages say only what the firm has verified; empty states are honest.
