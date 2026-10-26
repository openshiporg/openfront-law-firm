---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: []
---

Scope: Law Firm platform pages (features/platform/**), Operate mode. Audience: attorneys, paralegals, intake and billing staff clearing the day's obligations.

## Direction contract
THESIS: The platform is the firm's file room: every page opens on the records that carry an obligation (deadlines, conflicts, unbilled work, balances) and keeps its commands one tab away. It refuses the category default of a form wall above stacked cards and pill segmented tracks.
OWN-WORLD: Redweld expanding file. Rust ink (oklch 0.47 0.135 36) only for the primary action and current selection; manila table heads and file labels; ink text on the shell's white; square status marks; radii 2-6px; Geist with tabular, slashed-zero figures.
STORY: The operator sees what is due, opens the record, acts from the row, and records new work from the actions tab without leaving the page.
FIRST VIEWPORT: Title and firm/date line; underline section tabs (sticky); obligation strip of counts (Today) or the first ledger table with Record / Type / Status / Date / Action columns; primary rust action in the header where the page has one.
FORM: Redweld file jacket, candidate 4 of 7 (docket sheet, pleading paper, law reports, Redweld file, statute book, cause list, letterhead); seed:dcf7d73d0981d21f. Raises: hierarchy by heading scale, not boxes (type specimen); destructive actions outlined and apart (developer console); range in view on every table (lexicon); one fixed status vocabulary (transit diagram); rust reserved for the current obligation (orienteering).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
