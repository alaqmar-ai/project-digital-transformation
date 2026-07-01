# Sub-Project Schedule — Draggable Gantt, Submit-Lock & Plan-vs-Actual

**Date:** 2026-07-01
**Status:** Approved (verbal), building
**Surface:** `/sub-projects/[id]` (sub-project detail page)

## 1. Goal

Let a PIC lay out a sub-project's 11-stage schedule by **dragging bars on a
day-column calendar grid** (like the FUN-40 production-engineering sheet), then
**Submit** to baseline it. After submit the plan is soft-locked: the PIC can
still amend it themselves, but doing so **notifies** the overseer. Separately,
the PIC lays **actual** bars on top of the plan as work really happens, so
plan-vs-actual drift is visible at a glance.

## 2. What already exists (reuse, don't rebuild)

- `stage_schedules` table + `StageSchedule` type already hold `plan_start/end`,
  `actual_start/end` per stage per sub-project, with generated duration columns.
  11 stage rows auto-create on sub-project creation (`createSubProjectAction`).
- `StageGantt.tsx` — read-only SVG timeline (plan dotted / actual solid). **This
  gets replaced** by the new interactive grid.
- The detail page already has an editable stage table (Plan/Actual date inputs,
  Status, Remarks, expandable Checkpoints) and recomputes sub-project
  progress/status from stages (`deriveStageStatus`, `progressOfSubProject`).
  **This table stays** — it's the "type exact dates" path and holds
  status/remarks/checkpoints. Grid and table write the same date fields.
- Notifications: `notifications` table + `createNotification` store helper +
  `createNotificationAction`. Reuse for schedule-change pings.
- `canEdit = isAdmin(user) || sub.picId === user.id` — keep this rule.

## 3. Data model changes

**Migration `db/migrations/0009_schedule_lock.sql`** (idempotent, additive — no
truncation):

- `sub_projects`:
  - `schedule_status text not null default 'draft'` — `'draft' | 'submitted'`.
  - `schedule_submitted_at timestamptz`
  - `schedule_submitted_by uuid references users(id) on delete set null`
- `stage_schedules`:
  - `baseline_start date`, `baseline_end date` — snapshot of the plan captured
    on first Submit; drives the "original plan" ghost bar.
- `notification_kind_enum`: add value `'schedule_changed'`
  (`alter type ... add value if not exists`).

**Type changes (`src/lib/types.ts`):**
- `SubProject`: add `scheduleStatus: 'draft' | 'submitted'`,
  `scheduleSubmittedAt?: string`, `scheduleSubmittedBy?: string`.
- `StageSchedule`: add `baselineStart?: string`, `baselineEnd?: string`.
- `NotificationKind` (`src/lib/constants` / types): add `'schedule_changed'`.

**Mappers / actions (`src/app/actions/data.ts`):**
- `mapSub` → read the 3 new sub columns; `mapStage` → read baseline columns.
- `updateStageAction` already updates plan/actual — extend to also allow
  `baseline_start/end` writes (used only by submit).
- New `submitScheduleAction(subProjectId, userId)`:
  1. Validate every stage has `plan_start` and `plan_end` (else throw with the
     list of unfilled stage names).
  2. `update sub_projects set schedule_status='submitted',
     schedule_submitted_at=now(), schedule_submitted_by=$user`.
  3. Snapshot: `update stage_schedules set baseline_start=plan_start,
     baseline_end=plan_end where sub_project_id=$id and baseline_start is null`
     — **first submit only**, so the ghost always shows the *original* plan.
- New `notifyScheduleChangeAction(subProjectId, editorId, summary)` — resolves
  recipients server-side (see §5) and inserts notifications.
- Store wrappers in `src/lib/data/store.ts`: `submitSchedule`,
  `notifyScheduleChange` (Neon → server action; localStorage → local equivalents).

## 4. The schedule grid (`src/components/ScheduleGrid.tsx`)

Fixed **px-per-day** horizontal timeline (like FUN-40 / the legacy
`gantt/page.tsx`), horizontally scrollable. 11 stage rows.

**Layout**
- Left frozen column: `n. Stage name`.
- Header: month band + day ticks; weekends tinted; amber **today** line.
- Domain: from month-start of the earliest date across all
  plan/actual/baseline dates, to month-end of the latest, padded. Empty draft →
  default window = sub-project `plannedStart..plannedEnd` if set, else
  today → today+90d.
- `DAY_W` constant (≈10px/day); `xFromDate(d)` and `dateFromX(px)` are inverse;
  `dateFromX` **snaps to whole day**; bars enforce **min 1 day**.

**Bars (option A — stacked, confirmed):**
- Plan = blue bar, top track of the row.
- Actual = green bar, lower track; the portion past plan-end renders **red**
  ("ran over").
- Baseline ghost = faint hatched bar on the plan track, shown **only where the
  current plan differs from baseline** (drift). Hidden when plan == baseline.
- Exact date chip on hover/active (`01 Jul → 21 Jul · 21d`).

**Interaction (pointer events → touch + mouse):**
- Empty row (mode allows): click-drag across the track paints a new bar
  start→end.
- Existing bar: drag middle = move (duration preserved); drag left/right grip =
  set start/end. Snap to day; clamp to domain; min 1 day.
- On pointer-up: persist that stage via `updateStage` (plan or actual fields per
  mode), then recompute sub-project progress/status (reuse existing logic).

**Modes (one editable at a time):**
- `view` (default) — everything read-only.
- `plan` — blue bars draggable. Auto-on in draft; in submitted state entered via
  "Edit Plan" (saving notifies — §5).
- `actual` — green bars draggable. Entered via "Update Actual"; always silent;
  available once submitted.

## 5. Submit, soft-lock & notifications

**Submit (draft → submitted):**
- Button visible in draft to PIC or admin. Blocked unless all 11 stages have
  plan start+end (toast names the missing stages).
- Calls `submitScheduleAction` → status flips, baseline snapshotted, badge shows
  **Submitted**.

**After submit (soft-lock):**
- Plan bars are read-only by default. PIC/admin clicks **Edit Plan** to enter a
  plan-edit session; on **Save changes** we diff which stages moved and fire
  **one** notification (not one-per-drag).
- **Actual** editing (Update Actual) is always allowed and **never notifies** —
  it's routine progress, notifying would spam.

**Recipients** (`computeScheduleRecipients`, pure, unit-tested):
- Target set = { sub-project PIC } ∪ { overseer } **minus the editor**, deduped.
- Overseer = user with username `faris` (`SCHEDULE_OVERSEER_USERNAME`
  constant); if not found, fall back to all admins. Resolved server-side in
  `notifyScheduleChangeAction`.
- So: PIC edits → overseer pinged; admin edits → PIC pinged.
- Notification: kind `schedule_changed`, title
  `"Schedule changed: <sub project>"`, body
  `"<editor> amended the plan (<n> stage(s): <names>)"`, `refType:'sub_project'`,
  `refId: sub.id`.

## 6. Surface changes (`/sub-projects/[id]`)

- Replace `<StageGantt/>` with `<ScheduleGrid/>` (interactive).
- Toolbar above the grid: **Draft/Submitted badge**, and buttons per state:
  - draft: `Detailed Schedule` (enter plan edit) → `Submit` / `Cancel`.
  - submitted: `Edit Plan` (notifies on save) · `Update Actual`.
- Keep the existing stage table below (status/remarks/checkpoints + exact-date
  inputs). Its date inputs stay editable and write the same fields; when the
  plan is submitted, its plan-date inputs follow the same lock rule as the grid.

## 7. Permissions

| Action | PIC | Admin | Other |
|---|---|---|---|
| Edit plan (draft) | ✓ silent | ✓ silent | ✗ |
| Submit | ✓ | ✓ | ✗ |
| Edit plan (submitted) | ✓ → notify overseer | ✓ → notify PIC | ✗ |
| Edit actual | ✓ silent | ✓ silent | ✗ |
| View grid | ✓ | ✓ | ✓ (read-only) |

## 8. Decisions / edge cases

- Baseline captured on **first** submit only; re-drags never overwrite it, so the
  ghost is always the original committed plan. No re-baseline UI.
- Notification is **one per plan-edit session**, not per bar. `// ponytail:` if
  even that proves noisy, coalesce per day.
- All 11 stages required to submit; per-stage "N/A" skip is **out of scope**
  (add later if a stage genuinely never applies).
- Legacy global `gantt/page.tsx` (runs on the old `Project` model) is **not
  touched** — separate view.

## 9. Build sequence

1. **Data layer** — migration 0009, type + mapper + action + store changes.
   Verify: `npm run db:migrate` clean, `tsc`/build passes.
2. **Grid render (read-only)** — `ScheduleGrid.tsx` day-grid, stacked bars,
   ghost, today line; swap into detail page. Verify: existing data renders.
3. **Drag** — move/resize/paint, snap, min-1-day, mode switch, persist +
   recompute. Verify: `dateFromX`/`xFromDate` round-trip self-check.
4. **Submit + lock + notify** — submit validation/action, badge, edit-session
   diff → one notification, actual silent. Verify: baseline snapshot, badge,
   correct recipients (`computeScheduleRecipients` self-check).
5. **Polish** — table↔grid sync, legend, empty/mobile scroll. Verify: build +
   smoke.

## 10. Success criteria

- PIC drags 11 plan bars, Submit locks + baselines; badge = Submitted.
- Dragging a bar produces the exact snapped dates (verified by the math check).
- Post-submit plan amend → exactly the right people get one notification;
  actual edits produce none.
- Actual overrun shows red; plan drift shows the ghost.
- `tsc` + `next build` pass; nothing on the legacy gantt page breaks.

## 11. Tests (ponytail — one runnable check per non-trivial unit)

- `src/lib/schedule-geometry.test.ts` (or `__main__`-style assert): `dateFromX`
  ∘ `xFromDate` round-trips; snap lands on day; min-duration enforced.
- `computeScheduleRecipients` assert: editor excluded, PIC+overseer deduped,
  overseer-missing → admins fallback.
