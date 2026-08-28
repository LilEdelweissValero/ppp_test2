---
name: ITSD Project Tracker
description: Authoritative portfolio delivery authority for IT governance
colors:
  ground: "#F7F8FA"
  ground-metric: "#F0F2F6"
  surface: "#FFFFFF"
  ink-primary: "#0F1117"
  ink-secondary: "#4A5568"
  ink-tertiary: "#8896A8"
  ink-on-dark: "#F7F8FA"
  rule: "#DDE2EA"
  rule-strong: "#C4CCD8"
  accent: "#1A56DB"
  accent-hover: "#1447C0"
  accent-bg: "#EBF2FF"
  status-nys-bg: "#F1F3F6"
  status-nys-ink: "#5A6478"
  status-planning-bg: "#EAF1FE"
  status-planning-ink: "#1D4BAA"
  status-partial-bg: "#FFF3E0"
  status-partial-ink: "#8B5200"
  status-mostly-bg: "#E8F4FF"
  status-mostly-ink: "#0A5FA8"
  status-complete-bg: "#E6F4EE"
  status-complete-ink: "#1A6B3C"
  health-completed-bg: "#E6F4EE"
  health-completed-ink: "#1A6B3C"
  health-ontime-bg: "#E6F4EE"
  health-ontime-ink: "#1A6B3C"
  health-atrisk-bg: "#FFF0EE"
  health-atrisk-ink: "#B91C1C"
  health-delayed-bg: "#EAF1FE"
  health-delayed-ink: "#1D4BAA"
  health-notdue-bg: "#F1F3F6"
  health-notdue-ink: "#5A6478"
typography:
  display:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "clamp(22px, 3vw, 30px)"
    fontWeight: 750
    lineHeight: 1.1
  body:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  compact:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  micro:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.03em"
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, monospace"
rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#FFFFFF"
  health-badge:
    backgroundColor: "{colors.status-complete-bg}"
    textColor: "{colors.status-complete-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
---

# Design System: ITSD Project Tracker

## Overview

**Creative North Star: "The Audit Ledger"**

The ITSD Project Tracker embodies the authority of a well-maintained ledger — dense, trustworthy, and unambiguous. Every element earns its place through function, not decoration. The system presents portfolio delivery data with the precision of architectural drafting: full-color framework header cards anchor vertical rhythm, metric zones differentiate from identity zones through tonal contrast, and status communication happens through color-coded badges that read at a glance.

The aesthetic is document-forward: near-white drafting-paper ground, near-black technical ink hierarchy, and a restrained institutional blue reserved for interactive state. Density is a feature — the dashboard fits an entire portfolio in one view without losing scannability. The visual language says: this is the system of record.

**Key Characteristics:**
- Architectural drafting aesthetic with full-color framework header cards
- Dense data tables with metric zone / identity zone differentiation
- Tonal layering over shadows for depth hierarchy
- Restrained accent blue for interactive state only
- Status communication through semantic color badges

## Colors

The palette is institutional and restrained — neutral grounds with semantic color reserved for status and health indicators.

### Primary
- **Institutional Blue** (#1A56DB): Interactive elements — links, focus rings, selected states, primary buttons. Used sparingly; its rarity is the point.

### Neutral
- **Matte Paper** (#F7F8FA): Primary ground. The drafting-paper surface everything sits on.
- **Metric Ground** (#F0F2F6): Secondary ground for metric zones and summary rows. Differentiates data-dense areas from identity zones.
- **Surface** (#FFFFFF): Elevated surfaces — cards, panels, modal dialogs.
- **Technical Ink** (#0F1117): Primary text. Dense, precise, authoritative.
- **Secondary Ink** (#4A5568): Secondary text — descriptions, program names, supporting data.
- **Tertiary Ink** (#8896A8): Tertiary text — labels, placeholders, empty states.
- **Rule** (#DDE2EA): Default borders and dividers.
- **Strong Rule** (#C4CCD8): Emphasized borders — column headers, section dividers.

### Status (Semantic)
Five status colors mapped to project delivery states. Each has a background tint and ink pair.
- **Not Yet Started** (#F1F3F6 / #5A6478): Neutral, pending work.
- **Planning** (#EAF1FE / #1D4BAA): Active planning phase.
- **Partial Progress** (#FFF3E0 / #8B5200): In progress, partial completion.
- **Mostly Done** (#E8F4FF / #0A5FA8): In progress, near completion.
- **Complete** (#E6F4EE / #1A6B3C): Finished and verified.

### Health (Semantic)
Five health states for project risk assessment. Overlaps with status palette for visual consistency.
- **Completed / On Time** (#E6F4EE / #1A6B3C): Green family — healthy.
- **At Risk** (#FFF0EE / #B91C1C): Red family — needs attention.
- **Delayed** (#EAF1FE / #1D4BAA): Blue family — schedule slip.
- **Not Yet Due** (#F1F3F6 / #5A6478): Neutral — no action needed.

### Named Rules
**The Accent Restraint Rule.** Institutional Blue appears on ≤15% of any given viewport. It marks interactive state only — links, focus rings, selected filters, primary buttons. Never use it for decorative purposes or section backgrounds.

**The Status Pairing Rule.** Status and health colors always appear as bg+ink pairs. Never use the ink color alone without its background tint; never use the background tint without the matching ink.

## Typography

**Display Font:** Geist (with Inter fallback)
**Body Font:** Geist (with Inter fallback)
**Label/Mono Font:** Geist Mono (with JetBrains Mono fallback)

**Character:** The Geist pairing is modern, neutral, and highly legible at small sizes — engineered for dense data interfaces. The sans handles body text and headings with quiet authority; the mono distinguishes reference codes and tabular data without visual noise.

### Hierarchy
- **Display** (750 weight, clamp(22px, 3vw, 30px), line-height 1.1): Project detail titles. Appears once per detail view; anchors the page.
- **Title** (750 weight, 18px, line-height 1.2): Section headings in modals and detail views.
- **Body** (400 weight, 14px, line-height 1.5): Default text for all content. Max line length 65–75ch for readability.
- **Compact** (400 weight, 13px, line-height 1.4): Secondary text in tables, program names, supporting data.
- **Small** (400 weight, 12px, line-height 1.4): Table cells, form labels, action buttons, metadata.
- **Label** (600 weight, 10px, letter-spacing 0.08em, uppercase): Column headers, section labels, kicker text. The architectural drawing annotation style.
- **Micro** (600 weight, 11px, letter-spacing 0.03em): Status badges, health indicators, compact data.
- **Mono** (inherited size, Geist Mono): Reference codes, task codes, tabular data requiring alignment.

### Named Rules
**The Tabular Nums Rule.** All numeric columns in data tables use `font-variant-numeric: tabular-nums` for vertical alignment. Numbers must line up across rows.

**The Label Caps Rule.** Column headers and section labels use the label-caps style: 10px, 600 weight, 0.08em letter-spacing, uppercase. This is the architectural annotation voice — never use body text for headers.

## Layout

The layout is a dense vertical stack optimized for large-screen desktop viewing during planning cycles and team meetings.

**Container:** Max-width 1600px, centered, with 24px horizontal padding. On mobile (below 720px), padding reduces to 14px.

**Framework Card Grammar:** The primary layout pattern is the framework section — a vertical block opened by a header card filled with the framework's own color. Inside: framework header (name + summary + mini status bar) in full color, then a table with project rows on neutral ground. The color fill is scoped to the header only; it does not bleed into the table body.

**Table Zones:** Data tables split into two visual zones:
- **Identity Zone** (left): Project name, program, reference, owner. Dark header background (ink-primary), white text.
- **Metric Zone** (right): Task counts, quarters, status, health. Light header background (ground-metric), dark text.

**Responsive Behavior:** At 720px breakpoint, the detail meta grid collapses from 6 columns to 2 columns. Table horizontal scroll activates at 1280px minimum width.

**Spacing Rhythm:** 12px gap between framework sections. 8px gap between toolbar elements. 16px bottom margin on toolbar. Consistent 8-10px cell padding in data tables.

### Named Rules
**The Framework Card Rule.** Every framework section opens with a header card filled edge-to-edge in the framework's own color. The full-color fill is the primary visual anchor — it identifies the framework at a glance and provides vertical rhythm through the dashboard. The fill is confined to the header; the table body beneath stays on neutral ground/ground-metric.

## Elevation & Depth

The system is flat-by-default, using tonal layering rather than shadows to convey depth hierarchy. Shadows are rare and reserved for interactive response only.

### Shadow Vocabulary
- **Detail Hero** (`0 1px 4px rgba(15,17,23,0.07), 0 0 0 1px rgba(15,17,23,0.02)`): Project detail header panel. A focused, singular view — earns a resting lift.
- **Framework Card** (`0 1px 4px rgba(15,17,23,0.07), 0 0 0 1px rgba(15,17,23,0.02)`): Framework section container. Shares the Detail Hero token — the full-color header card is a primary navigational surface, not a decorative panel, so it earns the same resting lift.
- **Dropdown** (`0 4px 16px rgba(15,17,23,0.12), 0 1px 4px rgba(15,17,23,0.08)`): Actions menu and floating panels. Ephemeral overlay state.
- **Task Panel** (`0 1px 4px rgba(15,17,23,0.05)`): Minimal lift for task tables in detail view.

### Named Rules
**The Flat-By-Default Rule.** Most surfaces are flat at rest; tonal differentiation (ground vs. ground-metric vs. surface) does the depth work there. The framework card and Detail Hero are the sanctioned exceptions — both are primary navigational anchors and carry a resting shadow deliberately. Everywhere else, shadows appear only as response to state: hover, focus, or elevation change (dropdown).

**The Tonal Layering Rule.** Depth is communicated through background value, not shadow. The ground → ground-metric → surface progression implies increasing lift without any shadow.

## Shapes

The form language is minimal, functional, and sharp. Every radius earns its place through usability, not decoration.

**Corner Strategy:**
- **Sharp (0px):** Framework sections (including the color header card), table cells. The dominant silhouette — clean, architectural.
- **Micro (2px):** Status dots, health badges, small interactive elements. Just enough to soften a circle's edge.
- **Small (3px):** Buttons, inputs, dropdowns. Functional rounding for click targets.
- **Medium (4px):** Cards, panels, modal dialogs. The maximum radius in the system.

**Borders:** 1px solid rule (#DDE2EA) is the default divider. rule-strong (#C4CCD8) for emphasized borders (column headers, section breaks). No decorative borders.

**Clipping:** Tables use `overflow: hidden` on the framework container to keep the full-color header card's corners flush with the sharp-cornered container and maintain clean edges.

## Components

Components are tactile and precise — crisp borders, tight padding, functional hover states.

### Modal
- **Shape:** 4px radius, white background, centered overlay
- **Overlay:** `bg-black/50` — 50% opacity black backdrop
- **Header:** Bottom border, flex space-between, 16px padding
- **Body:** Scrollable content area, 24px padding
- **Close:** × character, gray hover state

### HealthBadge
- **Shape:** 2px radius, inline-flex container
- **Structure:** 6px status dot (circle) + label text
- **States:** Completed (green), On Time (green), At Risk (red), Delayed (blue), Not Yet Due (gray)
- **Typography:** 11px, 600 weight, 0.03em letter-spacing

### TableHeader
- **Dual-zone:** Identity zone (ink-primary bg, white text) + Metric zone (ground-metric bg, dark text)
- **Typography:** 10px, 600 weight, 0.07em letter-spacing, uppercase
- **Border:** Bottom rule-strong, right border on zone divider

### SortableRow
- **Hover:** accent-bg (#EBF2FF) background tint
- **Drag state:** 0.4 opacity, cursor grab
- **Grip icon:** 6-dot pattern, 10×14px, ink-tertiary color
- **Cell padding:** 8px 10px, bottom border rule

### ActionsMenu
- **Trigger:** Button with border rule-strong, 3px radius
- **Open state:** ink-primary background, white text
- **Dropdown:** White surface, rule-strong border, 4px radius
- **Shadow:** dropdown elevation token
- **Items:** 12px text, primary action in accent color

### StatusMiniBar
- **Structure:** Horizontal segmented bar, 8px height
- **Segments:** Color-coded by status, 1px gap between
- **Width:** Dynamic based on percentage (Math.max(3, pct × 80))
- **Opacity:** 0.75 for all segments

### DetailHero
- **Shape:** White surface, rule border, 4px top accent border
- **Shadow:** Detail hero elevation token
- **Content:** Kicker (10px caps), title (clamp display), meta grid (6-col → 2-col responsive)

## Do's and Don'ts

### Do:
- **Do** fill the framework header card in the framework's own color on every framework section — it's the primary visual anchor
- **Do** use tabular-nums for all numeric columns in data tables
- **Do** use label-caps style for column headers and section labels
- **Do** use status bg+ink pairs together — never separate them
- **Do** use ground-metric to differentiate metric zones from identity zones
- **Do** keep accent blue to interactive elements only (links, focus, selected state)

### Don't:
- **Don't** use accent blue for decorative purposes or section backgrounds
- **Don't** add shadows to cards or panels at rest, except the framework header card and Detail Hero — keep everything else flat
- **Don't** let the framework header's color fill bleed past the header into the table body
- **Don't** use body text style for headers — always use label-caps
- **Don't** round framework sections or tables — keep them sharp
- **Don't** use status colors for non-semantic purposes (decoration, emphasis)
- **Don't** add breathing room beyond the spacing scale — density is a feature
