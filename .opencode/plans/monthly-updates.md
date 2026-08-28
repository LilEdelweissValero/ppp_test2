# Plan: Monthly Updates View

## Overview
Add a "Monthly Updates" view accessible via the Manage button that opens as a standalone page (like `/history`). It displays a horizontally scrollable table with frozen identity columns (Framework, Program, Projects) and dynamic month columns showing project status and remarks over time.

**Critical requirement**: Progress % and status must reflect the **historical state** at each month boundary, not the current state. If a project was 50% in August and 75% now, the August column must show 50%.

## Historical State Reconstruction Strategy

The existing `lib/snapshot.ts` can reconstruct any project's state at any point in time by reversing change logs. However, calling `getSnapshotAt()` once per month would be O(N×M) — too slow for many months.

**Chosen approach: Reuse `getSnapshotAt()` with a performance note.**

- For each month boundary (last day of each month), call `getSnapshotAt(lastDayOfMonth + "T23:59:59")`
- This reuses the existing, tested snapshot logic — no code duplication
- For typical data volumes (< 500 logs, < 24 months), this completes in ~1-3 seconds
- If performance becomes an issue, we can optimize to a single-pass forward replay later

## Status Logic (per project per month)

The status for a project in a given month is determined by the project's **reconstructed state** at that month boundary:

| Status | Condition |
|--------|-----------|
| **Not Yet Started** | Project's `adjustedTargetQuarter` maps to a quarter containing this month, and no progress (all SpecialTask nys/plan/part/mostly/done at 0) |
| **In Progress** | Has progress (some SpecialTask > 0 for plan/part/mostly/done), and due this quarter or a future quarter |
| **Completed** | `actualCompletionDate` is set at that point in time, OR all SpecialTasks have `done == total` |
| **Delayed** | Project's `adjustedTargetQuarter` maps to a quarter that has already passed, but not completed |
| **Not Yet Due** | No progress, and the project is due in a future quarter |

## Month Columns
- Month columns appear for every month from the earliest history log edit to the current month (globally, across all projects)
- Format: "Aug 2026", "Sep 2026", etc.
- Each month has 2 subcolumns: **Status** and **Remarks**
- Month columns are ordered chronologically

## Remarks
- Default value per project per month: `"Project progress: __%"` where __ is computed from the **historical** `SpecialTask` aggregate at that month boundary: `(plan*25 + part*50 + mostly*75 + done*100) / total` across all SpecialTasks for the project
- If there's a log entry with a `remarks` field for that project in that month, use that instead
- Remarks cells are editable inline (textarea, multiline)
- Editing a remark creates a new `EntityChangeLog` entry with `changeType: "remarks"` via the existing `logChange()` utility

## Table Structure
```
| Framework | Program | Project | Aug 2026        | Sep 2026        | ...
|           |         |         | Status | Remarks | Status | Remarks | ...
|-----------|---------|---------|--------|---------|--------|---------| ...
| FWK A     | Prog 1  | Proj 1  | In Prog| 45%     | Delayed| 45%     | ...
|           |         | Proj 2  | NYS    | 0%      | In Prog| 30%     | ...
|           | Prog 2  | Proj 3  | Comp   | 100%    | Comp   | 100%    | ...
| FWK B     | Prog 3  | Proj 4  | Not Due| 0%      | NYS    | 0%      | ...
```

- Framework column: vertically merged (rowspan) when multiple projects share the same framework
- Program column: vertically merged (rowspan) when multiple projects share the same program
- Framework/Program/Project columns are frozen (sticky left)
- Month columns scroll horizontally

## Files to Create/Modify

### 1. New: `app/api/monthly-updates/route.ts` (API Route — ~120 lines)
- `GET` endpoint that returns fully reconstructed monthly data
- Algorithm:
  1. Fetch all `EntityChangeLog` entries, extract unique months (YYYY-MM), sort chronologically
  2. For each month, call `getSnapshotAt(lastDayOfMonth + "T23:59:59")` to get reconstructed state
  3. For each snapshot, extract project data (name, framework, program, adjustedTargetQuarter, actualCompletionDate, tasks, specialTasks)
  4. Compute progress % and status per project per month from the reconstructed state
  5. Aggregate remarks per project per month from the change logs
- Response shape:
  ```ts
  {
    months: { key: string; label: string }[],
    projects: {
      id: number; name: string;
      programName: string; frameworkName: string; frameworkColor: string;
      monthData: Record<string, { status: string; progressPct: number; remarks: string }>
    }[]
  }
  ```

### 2. New: `app/api/monthly-updates/remarks/route.ts` (API Route — ~40 lines)
- `POST` endpoint for saving inline-edited remarks
- Body: `{ projectId: number, monthKey: string, remarks: string }`
- Creates an `EntityChangeLog` entry with `changeType: "remarks"`, `entityType: "Project"`, `entityName: monthKey`, `remarks: remarks`
- Returns success/error

### 3. New: `components/MonthlyUpdatesView.tsx` (Client Component — ~500-600 lines)
- Main view component
- Fetches data from `/api/monthly-updates` on mount
- Builds month columns from the response
- Renders the frozen-column table with `position: sticky`
- Handles inline editing of remarks:
  - Click to activate textarea
  - Blur or Ctrl+Enter to save (calls `/api/monthly-updates/remarks`)
  - Esc to cancel
- Status badge rendering with color coding (reuse health badge colors)
- Framework/Program cell merging via rowspan calculation
- Loading and empty states

### 4. New: `app/monthly-updates/page.tsx` (Server Page — ~66 lines)
- Similar structure to `app/history/page.tsx`
- Server component with `export const dynamic = "force-dynamic"`
- Header with "ITSD Project Tracker" branding and back link
- Renders `<MonthlyUpdatesView />`

### 5. Modify: `components/DashboardView.tsx` (ActionsMenu)
- Add `"Monthly Updates"` menu item to the `items` array (~line 1395-1404)
- Add `onMonthlyUpdates` callback prop to the component signature (~line 1372)
- Wire it to `window.open("/monthly-updates", "_blank")` at the usage site (~line 2081-2090)

## CSS/Styling Approach
- Use CSS `position: sticky` for frozen columns (Framework, Program, Project)
- `sticky` with `left: 0` for each frozen column, with increasing `z-index` (3 for framework, 3 for program, 3 for project — all at same z since they don't overlap)
- Background color on frozen cells to prevent see-through when scrolling
- Month subcolumn headers use existing design tokens (`--ink-secondary`, `--rule`, etc.)
- Status badges: reuse health badge colors from `globals.css`
  - Completed: `--health-completed-bg` / `--health-completed-ink`
  - In Progress: `--status-planning-bg` / `--status-planning-ink`
  - Delayed: `--health-atrisk-bg` / `--health-atrisk-ink`
  - Not Yet Started: `--status-nys-bg` / `--status-nys-ink`
  - Not Yet Due: `--health-notdue-bg` / `--health-notdue-ink`
- Alternating row backgrounds (`--surface` / `--ground`)
- Min-width on the table to ensure horizontal scroll on smaller viewports

## Key Implementation Details

### Historical Snapshot Extraction
```typescript
// For each month, call getSnapshotAt to reconstruct state
import { getSnapshotAt } from "@/lib/snapshot";

const monthEnd = new Date(year, month + 1, 0); // last day of month
const timestamp = `${monthEnd.toISOString().slice(0, 10)}T23:59:59.000Z`;
const snapshot = await getSnapshotAt(timestamp);
// Extract project data from snapshot.frameworks -> programs -> projects
```

### Progress % from Historical State
```typescript
function computeHistoricalProgress(specialTasks: SnapshotSpecialTask[]): number {
  const total = specialTasks.reduce((s, st) => s + st.total, 0);
  if (total === 0) return 0;
  const weighted = specialTasks.reduce(
    (s, st) => s + st.plan * 25 + st.part * 50 + st.mostly * 75 + st.done * 100,
    0
  );
  return Math.round((weighted / total / 100) * 100); // 0-100 integer
}
```

### Status from Historical State + Month Context
```typescript
function getProjectStatus(project, monthKey) {
  const monthDate = new Date(monthKey + "-01");
  const monthQuarter = `Q${Math.floor(monthDate.getMonth() / 3) + 1} ${monthDate.getFullYear()}`;
  
  const progress = computeHistoricalProgress(project.specialTasks);
  const isCompleted = project.actualCompletionDate !== null ||
    project.specialTasks.every(st => st.done === st.total && st.total > 0);
  
  if (isCompleted) return "Completed";
  if (progress === 0 && compareQuarters(project.adjustedTargetQuarter, monthQuarter) > 0)
    return "Not Yet Due";
  if (progress === 0 && compareQuarters(project.adjustedTargetQuarter, monthQuarter) <= 0)
    return "Not Yet Started";
  if (progress > 0 && compareQuarters(project.adjustedTargetQuarter, monthQuarter) >= 0)
    return "In Progress";
  if (progress > 0 && compareQuarters(project.adjustedTargetQuarter, monthQuarter) < 0)
    return "Delayed"; // was due in past, has some progress, but not done
  if (compareQuarters(project.adjustedTargetQuarter, monthQuarter) < 0)
    return "Delayed";
  return "Not Yet Started";
}
```

### Sticky Column CSS
```css
.frozen-col {
  position: sticky;
  background: inherit; /* prevent see-through */
}
.frozen-framework { left: 0; z-index: 3; }
.frozen-program   { left: 120px; z-index: 3; } /* framework col width */
.frozen-project   { left: 270px; z-index: 3; } /* framework + program col width */
```

### Framework/Program Merging
```typescript
// Pre-compute rowspan for each framework and program
// Walk the sorted project list, count consecutive projects with same framework/program
function computeRowSpans(projects) {
  const fwkSpans = new Map(); // frameworkId -> rowspan
  const progSpans = new Map(); // programId -> rowspan
  
  let currentFwk = null, currentFwkCount = 0;
  let currentProg = null, currentProgCount = 0;
  
  for (const p of projects) {
    if (p.frameworkName !== currentFwk) {
      if (currentFwk) fwkSpans.set(currentFwk, currentFwkCount);
      currentFwk = p.frameworkName;
      currentFwkCount = 1;
    } else {
      currentFwkCount++;
    }
    // Same for program...
  }
  // Finalize last group
  if (currentFwk) fwkSpans.set(currentFwk, currentFwkCount);
  
  return { fwkSpans, progSpans };
}
```

## Execution Order
1. Create `app/api/monthly-updates/route.ts` (data API with snapshot reconstruction)
2. Create `app/api/monthly-updates/remarks/route.ts` (remarks save API)
3. Create `components/MonthlyUpdatesView.tsx` (main view component)
4. Create `app/monthly-updates/page.tsx` (server page wrapper)
5. Modify `components/DashboardView.tsx` (add menu item + wiring)
6. Test and verify
