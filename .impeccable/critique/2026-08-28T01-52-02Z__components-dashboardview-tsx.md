---
target: dashboard main page
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-28T01-52-02Z
slug: components-dashboardview-tsx
---
# Dashboard critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Historical state is clear; inline saves and failures are silent. |
| 2 | Match system / real world | 4 | The language and hierarchy closely match ITSD governance. |
| 3 | User control and freedom | 2 | Filters and collapse controls help, but edits and reordering lack undo. |
| 4 | Consistency and standards | 3 | The table system is coherent; framework fills/shadows conflict with the documented ledger grammar. |
| 5 | Error prevention | 1 | Blur-based edits commit without validation, confirmation, or rollback. |
| 6 | Recognition rather than recall | 3 | Main controls are labeled; editable cells disclose their behavior poorly. |
| 7 | Flexibility and efficiency | 2 | Search, sorting, bulk management, import/export exist; keyboard accelerators do not. |
| 8 | Aesthetic and minimalist design | 3 | Density is purposeful, though 15+ columns and duplicate aggregates create noise. |
| 9 | Error recovery | 1 | Network failures have no visible, actionable recovery path. |
| 10 | Help and documentation | 0 | No contextual legend or explanation of health/completion calculations. |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

The dashboard feels authored for ITSD through its quarter-first filtering, Framework -> Program -> Project hierarchy, historical view, status distribution, and planned-versus-adjusted quarter model. The dual-zone table is especially product-specific. The execution is less disciplined than the concept: full-width framework color fills and resting shadows conflict with DESIGN.md's restrained 6px spine and flat tonal layering.

The deterministic scan found one advisory `design-system-color` issue at `components/DashboardView.tsx:1073`: undocumented `#6366F1` in the phase badge. It is not an obvious false positive; the color should map to a documented semantic pair or be formally added to the design system. Browser overlays were unavailable because this harness exposes no mutable browser automation.

## Overall Impression

This is a credible, data-dense governance surface with unusually strong product fit. Its biggest opportunity is to make actions as trustworthy as the data: visible save feedback, recoverable failures, and keyboard-equivalent controls can be added without changing the information architecture.

## What's Working

- Framework, program, project, and metric zones make the product's defining hierarchy legible.
- Health badges pair color with text, so risk is scannable without relying on color alone.
- Historical mode changes the timestamp, adds an explanatory banner, and removes edit controls.

## Priority Issues

1. **[P1] Core table interactions are pointer-only.** Clickable `th`, `td`, and `div` elements handle sorting, editing, and collapse without native keyboard semantics or `aria-sort`/`aria-expanded`. Put buttons inside sortable headers and collapse controls, and provide keyboard edit/reorder paths. Suggested command: `$impeccable audit`.
2. **[P1] Silent optimistic edits undermine audit trust.** Reference, owner, and due-quarter edits save on blur, do not check responses, and offer no pending, success, retry, or rollback state. Add compact row/cell feedback and explicitly confirm audited schedule changes. Suggested command: `$impeccable harden`.
3. **[P1] Responsive behavior is overflow, not adaptation.** The 1280px minimum table width forces panning and loses row context at narrow widths and high zoom. Preserve the table but add sticky identity columns/header, priority-based column visibility, and a compact page header. Suggested command: `$impeccable adapt`.
4. **[P2] Framework styling dilutes the Audit Ledger direction.** Full-color headers and resting shadows overpower risk states and depend on user-defined contrast. Restore a narrow framework spine, neutral header ground, and flat rule-based separation. Suggested command: `$impeccable quieter`.
5. **[P2] Dense metrics lack interpretation and prioritization.** Five status counts plus totals, dates, status, percent, and health compete equally. Add lightweight definitions, visually prioritize exceptions, and mute zero-value counts. Suggested command: `$impeccable clarify`.

## Persona Red Flags

**Alex (power user):** Sorting is pointer-only, no dashboard shortcuts are visible, the Manage menu exposes eight ungrouped choices, and reordering lacks a precise keyboard path.

**Sam (accessibility-dependent):** Non-interactive headers/cells cannot reliably receive focus; the Manage menu lacks full keyboard menu behavior; at 200% zoom the wide table requires extensive horizontal navigation without sticky identity context.

**Mara (ITSD portfolio manager):** Quarter scanning is strong, but health rationale is opaque, search does not reveal which nested task matched, and silent edit failure could make an authoritative meeting view inaccurate.

## Minor Observations

- Turn the annual completion sentence into a labeled metric.
- Add a result count and one-click Clear search action.
- Explain which nested task field caused a project search match.
- Use button semantics for the clickable header timestamp.
- Add reduced-motion handling for animated progress treatments.
- Prevent historical snapshot failures from silently leaving a misleading historical banner over fallback data.

## Questions to Consider

- If health is the decision signal, should risk own the strongest emphasis rather than framework decoration?
- What visible response would make a manager trust that an inline edit is saved and logged?
- Which four metrics matter most during a quarterly review, and which can remain available through progressive disclosure?
