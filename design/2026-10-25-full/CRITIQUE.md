# Impeccable critique: Openfront Law Firm (before), 2026-10-25

Method: dual-agent. A was a design review against the before screenshots and source. B was `impeccable detect` over `features/platform`, `features/storefront` and the public routes.

## Detector (B)
- `impeccable detect` exited 0 with `[]` for all three scopes (201 + 47 + 14 files). It is a regex-only source scan, so element rules such as contrast and tiny text did not run; the clean result undercounts.
- A rounded-class census found 84 `rounded-(full|xl|2xl|3xl)` lines across 43 files, nearly all in `features/platform`. The source is `components/ui.tsx`: `trackClass`, `trackItemClass`, `pillClass` and `pillPrimaryClass` are all `rounded-full`. `SectionJumps` uses the same pattern.

## Scores (A)
- Platform: 18/40 (poor).
- Storefront: 18/32 (acceptable). Heuristics 7 and 10 were scored n/a.

## Priority issues
1. **[P1] Pages are built around record types, not the operator's task.**
   - Intake opens on a 10-field create form; the conflict review queue is below it.
   - Billing is a 2,600 px wall of forms (draft invoice, rate cards, two payment forms) before any invoice or collection data.
   - Today shows seven equal zero tiles and five identical "Nothing needs attention" boxes.
2. **[P1] One pill-on-track primitive serves as tab, filter, segmented choice, button and navigation,** so these controls look the same and give no affordance difference. `SectionJumps` repeats the panel headings directly below it.
3. **[P1] The storefront shows operator language to the public.** Examples: "Firm information is not yet published", "Public consultation services are not configured". In the unpublished state the site looks broken. The client-portal card outweighs the path for prospective clients.
4. **[P2] The storefront has no law-firm identity.** The serif display face does not render live. The logo is a generic periwinkle glyph against an oxblood accent. The page gives no city, practice focus or way to reach the firm.
5. **[P2] Matter pickers and disabled actions create recall and dead ends.**
   - Choosing a matter takes a select, a search box and a Find button.
   - Grey disabled buttons give no reason.
   - A "Data model" button sits in the operator header.

## Persona red flags
- **Paralegal:** the conflict queue is buried, and the phone form runs to about 1,200 px before any queue.
- **Billing partner:** no WIP, aging or trust view; counts instead of dollars.
- **Prospective client on a phone:** no phone number, address or attorney name, and the portal card is the biggest thing on the page.

## Minor
- Dashed empty boxes sit inside bordered cards (double borders).
- Five different pager formats.
- A half-width "Open a matter" card leaves dead space beside it.
- The "Slug" field is exposed to firm staff.
