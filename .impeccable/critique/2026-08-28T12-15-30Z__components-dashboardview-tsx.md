---
target: dashboard main page
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-08-28T12-15-30Z
slug: components-dashboardview-tsx
---
# Dashboard Critique — ITSD Project Tracker

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:---:|---|
| 1 | Visibility of System Status | 2 | Blur-triggered PATCH requests (reference/owner/due-quarter edits) show no loading, success, or error state |
| 2 | Match System / Real World | 3 | "as planned," NYS/Plan/Part/Mostly/Done vocabulary fits ITSD's own language |
| 3 | User Control and Freedom | 2 | Escape cancels an in-progress edit, but there's no undo once a PATCH has already fired on blur |
| 4 | Consistency and Standards | 2 | Framework header uses full-color fill + resting shadow, contradicting DESIGN.md's own spine/flat rules; editable cells give no visual cue they're editable until hover |
| 5 | Error Prevention | 1 | No client-side validation before PATCH; no confirmation before committing an audit-logged quarter change |
| 6 | Recognition Rather Than Recall | 3 | Column headers and color-paired badges support recognition; 17-column table taxes recall of what each column means |
| 7 | Flexibility and Efficiency | 3 | Search, quarter filter, sort, and keyboard-capable drag-reorder (`KeyboardSensor`) all exist |
| 8 | Aesthetic and Minimalist Design | 2 | Density is intentional, but every row carries ~13 undifferentiated data points/affordances |
| 9 | Error Recovery | 1 | Failed PATCH requests are swallowed (no `.catch()` on reference/owner edits); UI keeps showing the unsaved optimistic value |
| 10 | Help and Documentation | 1 | No legend for status/health meaning beyond a hover-only `title` tooltip; not keyboard- or touch-reachable |
| **Total** | | **20/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: This is genuinely authored for ITSD, not a generic admin table — the Framework → Program → Project hierarchy is structurally enforced in the component tree, the Identity/Metric zone split is real and consistently applied, quarters are first-class sort/filter dimensions, and copy like "as planned" is a domain-specific choice a generic table wouldn't make. But execution drifts from its own documented grammar exactly where identity matters most: the framework header — the single highest-identity surface in the hierarchy — uses a full-color fill and a resting shadow instead of the spec's 6px spine, which is precisely where "could be any generic admin panel with brand color" creeps in.

**Deterministic scan**: One advisory finding — `design-system-color` at `components/DashboardView.tsx:1073`. A phase-count badge uses an inline style with `color: "#6366F1"` (paired with `background: "#EEF2FF"`) that isn't in DESIGN.md's documented palette or tonal ramps. Not flagged as a false positive; it needs to either be formally added to the design system or swapped for a documented pair. This is a finding Assessment A didn't independently surface — the detector caught a small drift the design review missed while focused on larger structural issues.

**Visual overlays**: No browser automation tool was available in this session, so no live overlay could be injected into a [Human] tab. This is a fallback signal, not a finding — treat the CLI scan and source-level review above as the evidence for this run.

## Overall Impression

A dashboard with real product fit — the hierarchy and domain vocabulary are unmistakably ITSD's, not borrowed from a generic table. The gap is trust in the actions: edits that get silently committed (or silently fail) with zero feedback, and zero keyboard path, undermine a tool that positions itself as a system of record. The single biggest opportunity is making inline edits — especially audit-logged quarter changes — visibly confirmed, recoverable, and reachable without a mouse.

## What's Working

- **Identity/Metric zone contrast is real and consistently executed** — `TableHeader` correctly differentiates the dark identity header from the light metric header, and the pattern carries through summary rows too. This is the one piece of DESIGN.md's grammar that survived intact end-to-end.
- **HealthBadge always pairs background + ink + dot + label** (`HealthBadge.tsx:67-96`) — never color alone, which is both spec-compliant and partially accessible for colorblind users.
- **Keyboard-capable drag sensor is actually wired** (`KeyboardSensor` with `sortableKeyboardCoordinates`) — project reordering has a genuine keyboard path, which makes its absence everywhere else more conspicuous by contrast.

## Priority Issues

1. **[P0] Inline cell edits have no keyboard path at all.**
   **Why it matters**: Editing reference, owner, and due-quarter is triggered only by `onClick` on a `<td>` with no `tabIndex`, `role`, or `onKeyDown`. A keyboard-only or screen-reader user cannot edit a single project field from the dashboard — this is one of the two primary workflows this critique tested, and it's fully inaccessible without a mouse.
   **Fix**: Make editable cells real interactive elements (`<button>`/`tabIndex=0` with `onKeyDown` for Enter/Space to enter edit mode), matching the accessibility pattern already used on the drag handle elsewhere in the same file.
   **Suggested command**: `/impeccable audit`

2. **[P0] Silent, unconfirmed, audited edits.**
   **Why it matters**: `onBlur` fires a PATCH with no loading state and, for reference/owner, no `.catch()` at all — a failed save leaves the UI showing a value the server never persisted. The due-quarter change is explicitly audit-logged per PRODUCT.md, yet the UI gives it the same weightless treatment as a cosmetic text edit. A manager could believe they've re-planned a date in front of stakeholders and moved on, while the backend rejected it.
   **Fix**: Add optimistic-UI rollback on fetch failure (already implemented for drag-reorder, just not for cell edits) plus a lightweight inline "Saved" / "Failed to save" indicator, with a visibly different confirm-then-commit pattern for audited fields.
   **Suggested command**: `/impeccable harden`

3. **[P1] Framework header regresses from spine to full-color fill + resting shadow.**
   **Why it matters**: `background: fw.color` plus a resting `boxShadow` on every framework section directly contradicts DESIGN.md's "6px left spine, no full-color fills" and "no resting shadows" rules. This is the highest-identity surface in the hierarchy, so the drift is most damaging exactly where the Audit Ledger character should be strongest.
   **Fix**: Replace the full-fill header background with a 6px left spine + neutral header background, drop the resting shadow, reserve elevation for hover/dropdown per spec.
   **Suggested command**: `/impeccable quieter`

4. **[P2] Manage menu offers 9 flat, ungrouped choices.**
   **Why it matters**: `ActionsMenu` lists 9 items with no visual grouping, well past the ≤4-at-a-decision-point guidance. Frequent actions (Manage Projects, Manage Tasks) sit undifferentiated next to rare ones (Settings, View Archive) — costly during meeting-room time pressure.
   **Fix**: Group into clusters — entity management, data operations (Import, History), views (Monthly Updates, Archive), settings — or split into a secondary menu.
   **Suggested command**: `/impeccable layout`

5. **[P3] Dense project row exceeds one-thing-at-a-time and chunking guidance.**
   **Why it matters**: Each row renders 13+ distinct data points/affordances with uniform visual weight. Density is a stated product value, but undifferentiated density still taxes scanning — finding "what's at risk" means visually filtering past reference codes and owner names that don't serve that task.
   **Fix**: Reduce visual weight (lighter type, reduced opacity) on scan-secondary columns like Reference/Completion Date so Health/% and Program/Name dominate the read path.
   **Suggested command**: `/impeccable distill`

## Persona Red Flags

**Alex (power user, scans portfolio health in meetings)**: Reading "what's at risk" means scanning 17 columns with no visual weight difference between Health (the actual signal) and Reference (noise for this task). The 9-item Manage menu slows mid-meeting actions like jumping to History Log. Drag-reorder stays active even while a health sort is applied, so Alex could drag a row mid-sort and silently scramble the underlying `sortOrder` without any warning that sort and reorder are two different, conflicting orderings.

**Sam (accessibility-dependent user, edits a project's quarter)**: Cannot reach the due-quarter edit control by keyboard at all — no `tabIndex`, no `role`, no `onKeyDown`; tab order skips straight past it. Even with a pointer, there's no `aria-label` or focus-visible cue that the cell is editable — sighted users get a cursor change, screen-reader users get nothing. Once inside the edit control, `onBlur` is the only save trigger, so tabbing away commits an audited change with no explicit confirm step.

## Minor Observations

- `StatusMiniBar` segment meaning is exposed only via a native `title` tooltip — invisible on touch, unreachable by screen reader.
- The `#` column header (task count) is cryptic outside its hover tooltip.
- Empty-state copy ("No frameworks or projects yet.", "No tasks due in {quarter}") is calm and instructive — no complaint there.
- Two separate collapse mechanisms ("Collapse Frameworks" / "Collapse Programs") add a second axis to track, functionally fine but worth a naming pass.
- Detector flagged an undocumented `#6366F1` on the phase-count badge (`DashboardView.tsx:1073`) — either formalize it in DESIGN.md's palette or swap it for a documented status pair. Suggested command: `/impeccable colorize`.

## Questions to Consider

1. If quarter changes are audit-logged specifically because they're consequential, why does the UI treat committing one exactly like editing a free-text owner field — same blur-to-save, same zero feedback?
2. The framework header is the one place "which framework am I in" should be unmistakable — why is it the one place that abandoned the documented spine grammar for a full-color fill?
3. Is 17 undifferentiated columns actually "dense but scannable," or just dense — if Alex's real task is "find what's at risk in 5 seconds," does Reference/Completion Date on every row serve that, or just compete with the Health signal for the same visual budget?
