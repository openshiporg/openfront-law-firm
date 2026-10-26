---
name: Openfront Law Firm
description: Two worlds for one firm. A Redweld file room for the staff platform; the top sheet of a yellow legal pad for the public site.
colors:
  lf-rust: "oklch(0.47 0.135 36)"
  lf-rust-hover: "oklch(0.415 0.13 36)"
  lf-rust-ink: "oklch(0.46 0.135 36)"
  lf-on-rust: "oklch(0.99 0.005 80)"
  lf-manila: "oklch(0.968 0.026 86)"
  lf-manila-strong: "oklch(0.935 0.042 84)"
  lf-manila-line: "oklch(0.86 0.05 78)"
  pen-default: "oklch(0.460 0.100 30)"
  focus-default: "oklch(0.540 0.140 32)"
  margin-red: "oklch(0.58 0.175 24)"
  binding: "oklch(0.33 0.085 24)"
  pad: "oklch(0.958 0.072 101)"
  pad-2: "oklch(0.935 0.082 99)"
  sheet: "oklch(0.993 0.006 100)"
  pad-rule: "oklch(0.7 0.075 236 / 0.55)"
  pad-rule-strong: "oklch(0.6 0.09 240 / 0.8)"
  chipboard: "oklch(0.79 0.03 78)"
  chipboard-2: "oklch(0.72 0.032 76)"
  ink: "oklch(0.21 0.035 262)"
  ink-2: "oklch(0.32 0.035 260)"
  ink-muted: "oklch(0.43 0.04 255)"
  destructive: "oklch(0.520 0.180 27)"
  mark-amber: "oklch(0.66 0.15 65)"
  mark-green: "oklch(0.55 0.13 150)"
  mark-slate: "oklch(0.55 0.03 250)"
typography:
  display:
    fontFamily: "Libre Franklin, Franklin Gothic Medium, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 7.2vw + 0.5rem, 6.25rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Libre Franklin, Franklin Gothic Medium, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 3.6vw + 1rem, 3.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Libre Franklin, Franklin Gothic Medium, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.2vw + 1.1rem, 2rem)"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "Libre Franklin, Franklin Gothic Medium, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.4vw + 1rem, 1.25rem)"
    fontWeight: 400
    lineHeight: "2rem"
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  platform-page-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  platform-section:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  platform-body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  platform-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  platform-figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1, \"zero\" 1"
  file-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\" 1, \"zero\" 1"
rounded:
  mark: "1px"
  sheet: "2px"
  control: "4px"
  frame: "6px"
spacing:
  pad-line: "2rem"
  sf-gutter: "clamp(1.25rem, 4vw, 2.75rem)"
  sf-max: "76rem"
  platform-gutter: "16px"
  platform-gutter-md: "24px"
components:
  platform-button-primary:
    backgroundColor: "{colors.lf-rust}"
    textColor: "{colors.lf-on-rust}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  platform-button-primary-hover:
    backgroundColor: "{colors.lf-rust-hover}"
  platform-button-secondary:
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  platform-field:
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  platform-table-head:
    backgroundColor: "{colors.lf-manila}"
    typography: "{typography.platform-label}"
  platform-file-label:
    backgroundColor: "{colors.lf-manila}"
    typography: "{typography.file-label}"
    rounded: "{rounded.sheet}"
    padding: "0 6px"
    height: "20px"
  site-button-primary:
    backgroundColor: "{colors.pen-default}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "0 17.6px"
    height: "44px"
  site-button-raised:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0 17.6px"
    height: "44px"
  site-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0 14px"
    height: "46px"
  site-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "clamp(1.25rem, 2.5vw, 1.75rem)"
  site-card-ink:
    backgroundColor: "{colors.binding}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
  site-footer:
    backgroundColor: "{colors.chipboard}"
    textColor: "{colors.ink}"
---

# Design System: Openfront Law Firm

## Overview

**Creative North Star: "The Attorney's Desk"**

One firm, two objects on the same desk. Staff work in the **Redweld file room** (the platform pages under the shared Openfront dashboard shell): the expanding file jacket's rust is reserved for the one action and the one selection that matter now, manila marks table heads and typed matter labels, and everything else is ink on the shell's white. The public meets the **top sheet of the yellow legal pad**: a canary ground with pale blue rules, the red double margin line down the content's left edge, an oxblood binding strip glued at the head and a chipboard back as the footer, with the firm's name written large in Franklin Gothic.

Both worlds hold the same discipline. Hierarchy comes from heading scale and rules, not from boxes. Figures, dates and matter numbers are read in aligned columns. Corners stay square or nearly so. Each world has exactly one pen colour for action, and it is never spent on decoration. The shared dashboard shell (sidebar, header, breadcrumbs, its neutral tokens and its Geist face) belongs to Openfront, not to this system; the platform world sits inside it and borrows its neutrals.

**Key Characteristics:**
- Two scoped worlds: platform tokens are `--lf-*` on `:root`/`.dark`; public tokens live only inside `.storefront`.
- One action colour per world: rust on the platform, the firm's pen accent on the site.
- Ledger tables, ruled facts lists and underline tabs instead of card stacks and pill tracks.
- Square status marks (1px corners) carry one fixed status vocabulary.
- Tabular, slashed-zero figures on every count, amount, date and matter number in the platform.

## Colors

The platform is ink on white with manila paperwork and a single rust; the site is canary paper, blue rules, red margin, oxblood binding, and the firm's pen.

### Primary
- **Redweld Rust** (`lf-rust`): the platform's primary button fill, the active underline of section and command tabs, and the focus ring (at 40% / 20% alpha). Hover deepens to **Rust Hover** (`lf-rust-hover`); text on rust is **Rust-Paper White** (`lf-on-rust`). **Rust Ink** (`lf-rust-ink`) is the text form: a hovered record title and a hovered workspace icon. A dark-mode set lifts rust to a lighter terracotta (see sidecar).
- **Firm Pen** (`pen-default`): the public site's action and link colour. It is the default for `--color-accent`, which the firm overrides from a fixed preset list (Walnut, Oxblood, Forest, Slate, or a hue derived from its logo). Used for primary buttons, links, the current nav item's underline, checked choices, the caret, and the `sf-dot--accent` mark. **Focus Pen** (`focus-default`) draws the 2px focus outline.

### Secondary
- **Margin Red** (`margin-red`): the double margin line down the left of `main` (two 1px rules, 4px apart, 85% opacity), the risk status mark, and mixed at 45% into notice borders. It annotates; it never fills an action.
- **Oxblood Binding** (`binding`): the 0.5rem strip at the top of the header and the inverted "ink" sheet variant.

### Tertiary
- **Manila** (`lf-manila`): platform table heads, panel headers, file-label ground and the hover of workspace index cells. **Manila Strong** (`lf-manila-strong`) fills the checked option of a segmented choice. **Manila Line** (`lf-manila-line`) borders file labels and the left rule of a platform notice.

### Neutral
- **Canary Pad** (`pad`) is the site ground; **Pad Under-sheet** (`pad-2`) is the secondary/muted well.
- **Bond Sheet** (`sheet`): every card, field, raised button and checkbox row on the site; the text colour on pen and binding fills.
- **Pad Rule** (`pad-rule`) and **Strong Pad Rule** (`pad-rule-strong`): translucent blues. The lighter one draws the 2rem hero ruling and in-row dividers; the stronger draws row separators, field and card borders and the header's lower edge.
- **Chipboard** (`chipboard`, `chipboard-2`): the footer ground and its rules.
- **Navy Ink** (`ink`, `ink-2`, `ink-muted`): blue-black writing ink for headings, body and secondary text on the site. `ink` also draws the 2px rule over every section head.
- **Platform neutrals** are the shared shell's `background`, `foreground`, `muted`, `border`, `input`, `card`, `destructive` tokens. They are inherited, not owned, and are deliberately absent from the frontmatter.
- **Status marks**: the site uses `mark-amber`, `mark-green`, `mark-slate`, margin red and ink-muted; the platform uses Tailwind emerald 600, amber 500, rose 600, sky 600 and zinc 400 through one `statusTone` mapping (risk to rose, pending to amber, done to emerald, retired to zinc, anything else to sky).

### Named Rules
**The One Rust Rule.** On the platform, rust appears on the primary action and the current selection only. A surface has at most one rust-filled button; everything else is outlined or quiet text.

**The Firm's Pen Rule.** On the site, the accent is the firm's pen: actions, links, current location, checked choices. Never a background wash, a heading colour or an ornament.

**The Margin Is Not An Action Rule.** Margin red and oxblood are the pad's physical parts. They mark notices, risk and the binding; they never colour a button or a link.

## Typography

**Display Font (site):** Libre Franklin (with Franklin Gothic Medium, system sans)
**Body Font (site):** Libre Franklin, 400 to 800 loaded
**Platform Font:** Geist, inherited from the shared shell
**Mono:** Geist Mono, for code-like fields (`sf-field--mono`, currency codes)

**Character:** the site speaks in the face of American legal notices and court forms, one family whose weight carries the whole hierarchy; the platform speaks in the shell's plain grotesque, made exact with tabular, slashed-zero figures.

### Hierarchy
- **Display** (800, fluid to 6.25rem, 0.95): the firm's name across the ruled hero, balanced. One per site.
- **Headline** (800, fluid to 3.5rem, 1.0): page titles (Practice areas, Attorneys, Contact, legal pages, an attorney's name).
- **Title** (750, fluid to 2rem, 1.1): section heads above a 2px ink rule; account and portal sign-in headings.
- **Subtitle** (700, 1.25rem, 1.2): practice-area rows, the portal sheet heading; also the firm wordmark at 800.
- **Lede** (400, ~1.06 to 1.25rem, 2rem line on the pad's ruling, 46ch): the tagline under the firm name.
- **Body** (400, 1.0625rem, 1.7, 64ch): prose on About and legal pages; a lead paragraph steps to 500.
- **Label** (500, 0.875rem, ink-muted, sentence case): a quiet line under a title, footer column heads at 700.
- **Platform page title** (Geist 600, 1.5rem, tight): the `h1` in the page header, status beside it.
- **Platform section** (Geist 600, 15px, tight): record sections and the actions deck, with a muted tabular count beside it.
- **Platform body / label** (Geist 14px / 12px 500): table cells, field labels, table heads, meta.
- **Platform figure** (Geist 600, 1.25rem, tabular slashed-zero): obligation counts; a zero drops to muted.
- **File label** (Geist 600, 11px, tabular slashed-zero): the typed matter number.

### Named Rules
**The Weight Carries It Rule.** The site uses one family. Hierarchy is weight (800/750/700 against 400 to 600) and size, with negative tracking on display sizes; never a second display face.

**The Slashed Zero Rule.** Every count, amount, date, range and matter number on the platform carries `tabular-nums slashed-zero`. A figure without it is a defect.

## Layout

**Platform.** Inside the shell's page container: header (title with status, firm/date meta line, primary action at right) then content padded 16px, 24px from `md`. A sticky underline section index appears only at three or more sections. Ledger sections stack vertically with a heading row (title, count, range in view, View all) above a framed table; the Today page opens on a ruled obligation strip of counts (auto-fit columns, min 9rem, divided by vertical hairlines). Commands live in a tabbed actions deck below the records, every panel kept mounted so half-filled forms survive. Below `sm`, table rows restack as a two-column grid: record line, then status and action.

**Site.** Content max 76rem with a fluid gutter. The hero is ruled every 2rem; its grid is 1.7fr / 1fr from 60rem, the firm name and facts on the left, the client-portal sheet smaller to the right. Pages split into main plus a 22rem (or 26rem) sticky aside from 60rem. Sections are separated by 3 to 5rem of fluid space, each headed by a 2px ink rule. Text navigation appears at 60rem; below it a native details sheet opens the menu and a sticky bottom dock holds the one primary action.

**The Range In View Rule.** A paged platform table states its range ("1–25 of 140") beside its pager in tabular figures.

**The Records First Rule.** Platform pages open on records that carry an obligation; forms sit behind the actions deck, never as a wall above the tables.

## Elevation & Depth

Both worlds are flat by default and draw structure with rules. The platform frames ledgers with 1px borders and uses `shadow-lg` only on floating row-action popovers. The site lets bond sheets rest on the pad with a soft, low, negative-spread shadow, the only depth in the world; the mobile menu sheet casts a slightly longer one.

### Shadow Vocabulary
- **Sheet on pad** (`box-shadow: 0 8px 18px -14px oklch(0.3 0.05 80 / 0.45)`): cards.
- **Portal sheet** (`box-shadow: 0 10px 22px -16px oklch(0.3 0.05 80 / 0.5)`): the hero's client-portal sheet.
- **Menu sheet** (`box-shadow: 0 18px 30px -18px oklch(0.25 0.04 80 / 0.45)`): mobile menu.
- **Platform popover** (Tailwind `shadow-lg`): the row action form floating over a table.

**The Line Weight Rule.** State is carried by line weight: a 2px ink rule over a section, 1px blue rules between rows, a 2px ink underline under a field. Add a rule before adding a box.

## Shapes

Square to nearly square. On the site every corner is 2px (sheets, buttons, fields, notices, skip link); status marks are 0.5rem squares with 1px corners. On the platform, controls (buttons, fields, segmented choices, error banners) are 4px, framed sections and row lists 6px, file labels and inline links 2px, status marks 1px. Nothing is pill-shaped; a "pill" class name in the code is a square button.

## Components

### Buttons
- **Platform primary:** rust fill, rust-paper text, 32px tall, 12px inline padding, 4px corners, 14px/500. Hover deepens; disabled falls to muted. One per surface, in the page header where the page has one.
- **Platform secondary:** shell-white with `input` border, muted hover. **Quiet track item:** borderless muted text that fills muted on hover.
- **Platform destructive:** outlined in destructive at 40%, destructive text, a 5% wash on hover; the caller keeps it apart from neighbours.
- **Site primary:** pen fill, bond-sheet text, 44px tall (36px small, 50px large), 2px corners, 600 weight; hover mixes the pen 14% toward black; press nudges down 1px.
- **Site raised:** bond sheet with an ink border; hover turns border and text to the pen. **Site quiet:** transparent ink-2 text with a 5% ink wash on hover.
- **Focus:** platform rings 2px rust at 40% alpha with 1px offset; site outlines 2px in the focus pen with 2px offset.

### Chips (segmented choices)
- **Platform segmented choice:** a joined, 4px-cornered row of 32px options; the checked option fills manila strong at 500 weight. No pill tracks.
- **Site time slots:** square bond-sheet options with a strong blue border and tabular figures; checked fills with the pen.

### Cards / Containers
- **Platform panel / record section:** 6px frame, 1px border, card ground; the header row is manila with a 14px semibold title. Hierarchy comes from the heading, never from a box inside a box.
- **Site sheet:** bond sheet, 2px corners, strong blue 1px border, sheet-on-pad shadow, fluid 1.25 to 1.75rem padding, foot divided by a pad rule. The ink variant is oxblood with sheet text.

### Inputs / Fields
- **Platform field:** 36px min, 4px corners, `input` border, 10px inline padding, 14px text; focus turns the border rust with a 2px rust ring at 20%; invalid turns the border destructive. Labels are 12px/500 muted above the control.
- **Site field:** a white slip on the pad, 46px min, 2px corners, strong-blue 1px border with a 2px ink-2 underline, pen caret; focus swaps border to the focus pen with a 3px 22% halo. Checkbox rows are bond sheets whose border turns pen when checked.

### Navigation
- **Platform tabs:** section index and actions deck both use flat underline tabs, 40px tall, 20px apart; the current tab carries a 2px rust underline and 500 weight; the index is sticky with a translucent background and shows tabular counts. Arrow keys move between action tabs.
- **Site header:** sticky, oxblood binding strip on top, strong blue rule below; firm wordmark (Franklin 800) left; plain text links 64px tall with a 2px underline that turns pen on the current page. Mobile: a details sheet listing links at 1.25rem/700 on ruled lines.
- **Site footer:** chipboard back, four columns from 52rem, 700 column heads, required legal notices in the base row at 12px.

### Ledger Table (signature, platform)
Record / Type / Status / Date / Action columns; manila head row with 12px muted labels and 5px top corners; hairline-divided body; row hover washes muted at 40%. The record cell holds the title (rust ink and underline on hover), then a meta line with the file label, the rest of the subtitle, and the date in tabular figures. The row's next action sits at the right edge.

### File Label (signature, platform)
The matter number (`2026-001`) as a typed jacket label: 20px tall, manila ground, manila-line border, 2px corners, 11px/600 tabular slashed-zero. It is split off any subtitle that begins with a matter number.

### Ruled Facts and Index (signature, site)
Facts are a two-column `dl` on the pad's 2rem ruling (hero) or between strong blue rules (elsewhere): muted 14px term, 600 value. Practice areas are an ordered index under a 2px ink rule, one ruled line each, the whole row clickable, its title turning pen and underlined on hover.

### Status Mark
A square mark (8px, 1px corners) beside a 12px/500 (platform) or 14px/600 (site) label, in a status column or on a title line.

## Do's and Don'ts

### Do:
- **Do** keep platform tokens on `--lf-*` and public tokens inside `.storefront`; the shared shell keeps its own.
- **Do** give each platform surface at most one rust-filled button, and put rust on the current tab underline.
- **Do** set every platform figure with `tabular-nums slashed-zero` and type matter numbers as file labels.
- **Do** head every site section with a 2px ink rule and separate rows with 1px strong-blue rules.
- **Do** write site hierarchy in Libre Franklin weight: 800 for the firm name and page titles, 400 to 600 for text.
- **Do** keep corners at 2px on the site and 1 to 6px on the platform.
- **Do** keep the red double margin line, the oxblood binding strip and the chipboard footer; they are the pad.

### Don't:
- **Don't** describe or restyle the shared dashboard shell (sidebar, header, breadcrumbs) as part of this system.
- **Don't** stack forms above records on a platform page; put commands in the actions deck.
- **Don't** use pill-shaped buttons, pill segmented tracks or rounded-xl cards in either world.
- **Don't** spend rust or the firm's pen on backgrounds, headings or decoration.
- **Don't** put a box inside a box; a platform empty state is one quiet line.
- **Don't** introduce a second display face or a serif on the public site.
- **Don't** colour actions with margin red or oxblood.
