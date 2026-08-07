# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

IT department managers and program leads within the ITSD (IT Services Department) organization. They use the tracker actively — creating frameworks, programs, projects, and tasks; adjusting quarterly targets; monitoring health; and reviewing delivery status, typically in a desktop browser during planning cycles and team meetings. Secondary audience: executives and stakeholders consuming read-only dashboard views of portfolio health and progress.

## Product Purpose

An internal portfolio management tracker purpose-built for the ITSD org's governance structure. Manages the full delivery lifecycle — from framework-level strategy down to individual task execution — organized around fiscal quarters as the primary planning unit. Success means managers can confidently track what is due when, surface delivery risk early via health indicators, and present a credible portfolio status to leadership without maintaining a separate spreadsheet.

## Positioning

The 3-level hierarchy — Framework → Program → Project → Task — directly mirrors ITSD's own governance structure, which generic tools (Jira, spreadsheets) cannot model without extensive configuration. Quarterly targeting with both original and adjusted quarters, plus change logging, gives the org an audit trail that a spreadsheet cannot provide.

## Operating Context

- Desktop browser, likely large-screen; data-dense dashboards in team meetings
- Quarterly planning cycles drive the primary workflow (target quarter, adjusted quarter, actual completion)
- Projects are drag-reorderable within programs; programs are collapsible by framework
- CSV import is supported for bulk data entry
- Data lives in a local SQLite database (self-hosted / intranet deployment)
- Change history is logged per entity for audit and accountability

## Capabilities and Constraints

- Data model: Framework → Program → Project → Task (4 levels, each with metadata)
- Projects carry: reference code, owner, target quarter, adjusted quarter, actual completion date, health status, percent complete
- Tasks carry: task code, assignee, priority, status, target quarter, adjusted quarter, deliverable, dependencies, notes, attachment URL
- Health computed from task status; displayed as badge at project level
- Quarter-based filtering on dashboard
- Drag-and-drop reordering of projects within programs
- Framework color-coding for visual grouping
- No user authentication in scope (internal tool)
- Next.js 15 / React 19 / Tailwind 4 / Prisma 7 / SQLite

## Brand Commitments

- Product name: "ITSD Project Tracker" — preserve this name exactly
- No official logo, color palette, or style guide mandated
- Professional, readable, and suitable for internal enterprise use

## Evidence on Hand

- Full working implementation: dashboard, project detail view, modals (task form, project form, change quarter, change history, import CSV, manage frameworks, manage programs)
- Seed data and migration history in `/prisma/`
- No external brand assets or style guide on file

## Product Principles

1. **Hierarchy is the feature.** The Framework → Program → Project → Task structure is the core value proposition; it must always be legible at a glance.
2. **Quarters are the unit of truth.** Every delivery decision is expressed in quarters; date precision below that level is secondary.
3. **Health surfaces risk.** Managers shouldn't have to click into every project to know what's in trouble; health indicators do that work.
4. **Audit by default.** Changes to schedules and targets are logged; the tracker is a system of record, not just a planning aid.
5. **Dense but not overwhelming.** The dashboard must present a full portfolio in one view without losing scannability; density is a feature, not a problem.

## Accessibility & Inclusion

Internal enterprise tool; professional readability standard expected. No specific accessibility requirement was established beyond standard web baseline.
