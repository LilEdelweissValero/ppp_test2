# Plan: Phases Edit Modal

## Overview
Add a general edit phases modal accessible via a dynamic button above the phases table. The modal lets users edit all phases at once (names + weights), edit the phases table name (default "Phases", persisted in DB), and validates that total weight equals 100% before saving.

## Changes Required

### 1. Database: Add `phasesTableName` to Project model

**File:** `prisma/schema.prisma` (line ~42, in Project model)
- Add: `phasesTableName String? @map("phases_table_name")`
- Nullable, defaults to null (UI treats null as "Phases")

**Migration:** Run `npx prisma migrate dev --name add-phases-table-name`

**File:** `lib/portfolio-data.ts`
- Include `phasesTableName` in the project select for `getDashboardData` and `getProjectData`

**File:** `lib/snapshot.ts`
- Add `phasesTableName` to SnapshotProject interface
- Include in the project select and reconstruction logic

### 2. API: Update Project endpoints to handle `phasesTableName`

**File:** `app/api/projects/[id]/route.ts`
- Add `phasesTableName` to the PATCH handler's diffed fields (line ~134)
- Allow setting/unsetting the value

**File:** `app/api/projects/route.ts`
- Accept `phasesTableName` on POST for new projects (optional)

### 3. UI: Add dynamic "Edit Phases" button

**File:** `components/ProjectDetailView.tsx`

- Add state: `const [showEditPhases, setShowEditPhases] = useState(false);`
- Near the phases table header (around line 782-800), add a button in the upper-right corner of the section:
  - Button text: `Edit ${project.phasesTableName || "Phases"}`
  - Visually matches the "Add Phase" button style
  - Only shown when not in historical mode
  - Click opens `PhaseEditModal`
- Remove the individual "Edit" button from each phase row (line ~847)

### 4. New Component: `components/PhaseEditModal.tsx`

A modal that edits ALL phases at once plus the table name.

**Props:**
```ts
{
  open: boolean;
  onClose: () => void;
  projectId: number;
  currentTableName: string | null; // "Phases", "Groups", etc.
  phases: CachedPhase[];
  tasks: CachedTask[];
  specialTasks: CachedSpecialTask[];
  compSettings: ComputationSettings;
  onSaved: (tableName: string, updatedPhases: CachedPhase[]) => void;
}
```

**UI Layout:**
```
┌─────────────────────────────────────────────┐
│ Edit Phases                                 │
├─────────────────────────────────────────────┤
│ Table Name: [ Phases         ]              │
│                                             │
│ Name          Weight    Actions              │
│ ─────────────────────────────────────────── │
│ Planning      [ 30 ] %   [Delete]           │
│ Development   [ 50 ] %   [Delete]           │
│ Testing       [ 20 ] %   [Delete]           │
│                                             │
│ [+ Add Phase]                               │
│                                             │
│ Total Weight: 100%  ✓                       │
│                                             │
│         [Cancel]  [Save]                    │
└─────────────────────────────────────────────┘
```

**Validation:**
- Total weight must equal exactly 100% — block Save if not
- All phase names must be non-empty — block Save if any empty
- Show error message: "Total weight must equal 100% (currently X%)"

**API calls on Save:**
- `PATCH /api/projects/{id}` with `{ phasesTableName: tableName }` (if changed)
- For each phase: `PATCH /api/phases/{id}` with `{ name, weight }` (if changed)
- Call `onSaved()` with updated data

**Progress display:**
- For each phase, show a small progress bar like the existing table (% complete from tasks)
- This is read-only display, not editable in the modal

### 5. Update CachedPhase type

**File:** `components/PortfolioCacheProvider.tsx`
- Add `phasesTableName?: string | null` to the project cache interface if needed

## Execution Order
1. Add `phasesTableName` to Prisma schema + migration
2. Update `lib/portfolio-data.ts` and `lib/snapshot.ts` to include the new field
3. Update `app/api/projects/[id]/route.ts` to handle the new field
4. Create `components/PhaseEditModal.tsx`
5. Update `components/ProjectDetailView.tsx` (add button, remove per-row edit, wire modal)
6. Test and verify
