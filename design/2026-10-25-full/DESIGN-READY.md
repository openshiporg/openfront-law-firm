# Law Firm: full redesign, 2026-10-25

- Brief: `~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`
- Live site: https://openfront-law-firm-production.up.railway.app. `law-firm.openship.org` did not resolve yet.
- Commits on master (each auto-deploys):
  - `5bda2e4` redesign
  - `20b490c` invoice ledger and phone rows
  - `6fa3e56` finish-review fixes
  - the commit that adds this report and DESIGN.md

## What the operator and the visitor get now

### Platform pages (`features/platform/**`): the "Redweld file" world
- **Shared pieces** (`components/ui.tsx`, `PracticeSurface.tsx`, `SectionTabs.tsx`, `CommandDeck.tsx`, `practice.css`):
  - Tabs: flat underline tabs replace the recessed pill tracks everywhere.
  - Buttons: square, with a 4px radius. Frames have a radius of 6px or less.
  - Records: shown as ledger tables with a manila header row and Record / Type / Status / Date / Action columns. Each status is a square mark plus a label.
  - Matter numbers: rendered as file labels.
  - Colour: rust is used only for the primary action and the current tab.
  - Empty states: one written line per section (for example, "No deadlines awaiting review"). Empty sections are not boxed.
  - Pager: one format, "1–12 of 40", hidden when the count is zero.
- **Today:** a ruled strip of obligation counts, then deadlines and tasks as the lead table, then intake, matters, billing and holds as compact half-width tables. On phone the counts sit in one row of four.
- **Matters, Calendar & tasks, Documents, Communications, Time & expenses:**
  - Records come first.
  - "Start client intake" is the header's primary action on Matters.
  - Create forms come after the records.
  - On Time & expenses, the timer and the new-entry form come first, because capture is that page's job.
- **Billing, Trust & accounting, Client portal, Governance:**
  - Records come first.
  - Commands sit in one tabbed actions area: Draft invoice / Record payment / Refunds / Rates, or Post to trust / Reconcile / Trust accounts.
  - Billing opens on an invoice ledger: invoice, client, matter label, status, due, balance, total.
- **Intake & conflicts:** the queues lead. Conflict review and "Open matter from cleared intake" come next. The new-intake form is folded behind its own disclosure, and "New intake" is the header action.
- **Matter page:** works like a matter file.
  - The main column lists deadlines and tasks first, then documents, communications, invoices and parties.
  - A side column holds client and attorney identity, dockets, team, confidentiality, ethical walls and history.

### Public site (`features/storefront/**`, public routes): the "legal pad" world
- **The pad:** a canary sheet with pale blue rules in the hero and a red double margin line down the content.
  - An oxblood binding strip sits at the head; the footer is chipboard.
  - Type is Libre Franklin throughout, with an 800-weight firm name.
  - Navigation is plain text with an underline for the current page.
  - Buttons are square, coloured in the firm's own accent (its "pen").
- **Home:**
  - The firm's name is set large.
  - When the site is unpublished, one honest line says so.
  - A ruled facts list covers Consultations, Email and Clients.
  - The primary action is email when an address is listed, otherwise the client portal.
  - A smaller client-portal sheet sits on the right.
- **Contact:** a ruled facts table. Values the firm hasn't published read "Not listed online". The legal notices are kept.
- **Eyebrow labels:** moved under their headings on every page.
- **Provenance and non-claims:** the "Fictional local workspace" and "not legal advice" text is kept.

### What stayed
- **Untouched:**
  - every route, state and workflow
  - the shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside the platform routes)
  - onboarding and seed files
- **Firm-owned content:** the firm's logo and accent come from its own settings and were not changed.

## Skills used, per screen, and what each changed
- **impeccable**
  - `context`, plus `init`. Init wrote `PRODUCT.md` from repository evidence, marked as inferred, because the brief ordered no approval stage.
  - `critique`, dual-agent: an isolated design review plus the `detect` scan. Output is in `design/2026-10-25-full/CRITIQUE.md`. It drove the task-first ordering of Intake, Billing and Today, and the copy fixes on the public site.
  - `concept-seed`: one roll for the platform (operate) and one for the public site (persuade). Each was rolled against my own seven-candidate list; challengers were weighed, and their disciplines were raised into the direction contracts in `.impeccable/surfaces/`.
  - `craft-floor`: the build rules. No eyebrows above headings, no rounded or pill controls, tabular figures, and visible states.
  - `impeccable-finish-reviewer`, one full round:
    - Disposition: **fix**.
    - Applied in `6fa3e56`: the contact facts table, the home dead end, written empty states, the intake fold, rust kept off plain links, one pager format, the phone count strip, and square monograms.
  - `impeccable-documenter`: wrote `DESIGN.md` and `.impeccable/design.json` from the shipped code.
- **design-taste-frontend / hallmark:** anti-default calibration and honest copy (no invented practice areas, attorneys or claims). Applied on the public pages.
- **frontend-design:** the self-check against the cream-and-serif and SaaS-card defaults (this is why the site is canary and Franklin, not cream and Newsreader), and the "one bold move" (the margin line and pad).
- **minimalist-ui and industrial-brutalist-ui:** read. Their flat-control and ruled-structure discipline shaped the ledger tables. Their pill badges and terminal costume were declined.
- **emil-design-eng and apple-design:** press feedback, 160ms ease-out transitions, and hover-only effects. Applied to the site's buttons and fields and the platform's tabs.
- **high-end-visual-design and gpt-taste:** read and declined. Their pill buttons, floating pill navs and GSAP choreography conflict with the owner's no-pill order and with operator software.
- **color-expert and platform-design:** contrast checks on rust and white (about 6:1) and on the pad, ink and pen colours.

## Gates
- **Typecheck:** `tsc --noEmit -p .` through `heavy-exec.py`, child exit 0 and 0 errors, after every batch.
- **Unit tests:** `node --test tests/family-security.test.cjs tests/shared-dashboard.test.cjs`, 22 passed and 0 failed.
- **Parity:** `parity-check.py`, drift 0, missing 0, sidebar branding and structure ok.
- **Live check:** after each deploy, the CSS or HTML was checked for a marker that exists only in the new code.

## Open items (not done, and why)
- **Matter picker:** still select + search + Find. A single combobox is a larger change to `SearchableOptionSelect`.
- **Firm/date line:** shown on Today only. Adding it to every platform header needs a data fetch in the client page frame.
- **Onboarding radii:** onboarding still has rounded cards. The brief forbids touching onboarding files.
- **Accent contrast check:** the storefront accent check in `lib/accent.ts` still uses 3:1 against the old paper. The pen fills buttons, so 4.5:1 would be stricter. Changing it changes which accents a firm can keep, so it is left as an owner decision.
- **Demo data is thin:** one matter, and the storefront is unpublished. The screenshots therefore show mostly empty states.

## Screenshots
- Before and after: `design/2026-10-25-full/before/` and `after/`, desktop 1440 and phone 390, full page.
- Capture engines differ:
  - Before shots and the first after round used Playwright Chromium.
  - The final after round used WebKit, because Chromium stopped loading pages on this machine partway through the session.
