# Application Tracker Feature

> **A Kanban board for managing the job-application pipeline, auto-populated from the tailor flow.**

## Overview

The Application Tracker (`/tracker`) gives each tailored resume a place in a
seven-column Kanban pipeline. Tailoring a resume to a job auto-creates an
`applied` card; users can also add cards manually from a pasted job
description. Cards are drag-and-drop reorderable within and across columns.

## Columns (stable keys, decoupled from i18n labels)

`saved` · `applied` · `no_response` · `response` · `interview` · `accepted` · `rejected`

Auto-created cards from the tailor flow land in **`applied`**. Manual cards
default to `applied` but can be created as `saved`.

## How It Works

1. **Auto-create:** `POST /resumes/improve/confirm` (and the legacy
   `POST /resumes/improve`) create an `applied` card after persisting the
   tailored resume — best-effort (a tracker failure never breaks tailoring).
   Company/role come from the cached keyword-extraction pass, so there is **no
   extra LLM call** on this path.
2. **Manual add:** `POST /applications` creates the job from the pasted JD then
   the card; when company/role aren't supplied it runs one best-effort
   extraction call (falls back to blank/editable).
3. **Drag/drop:** cards reorder within a column or move across columns; the
   board updates optimistically and reverts on a failed `PATCH`.
4. **Detail modal:** shows the JD + the applied resume; **Edit** opens
   `/builder?id=<resume_id>`. Tolerates a deleted resume (`resume: null`).
5. **Bulk actions:** multi-select cards to move or delete in one request.
6. **Interview time:** while a card is in the **`interview`** stage its detail
   modal offers a date+time editor (`datetime-local`) that persists
   `interview_at` via the regular card PATCH. The value is shown on the card
   and in the modal meta row regardless of the current stage (moving the card
   out of `interview` keeps it; saving an empty value clears it).
7. **Stage visibility (Manage):** the header **Manage** button opens a dialog
   with an on/off switch per stage. Hidden stages are a **frontend render
   filter only** — their cards stay in the board state and on the server, and
   re-appear untouched when the stage is switched back on. The choice is
   stored per browser in `localStorage`
   (`resume_matcher_tracker_hidden_statuses`, only hidden keys, unknown keys
   dropped on read) and re-applied after mount, so it survives refreshes.
   Hiding every stage shows an "all stages hidden" hint (not the empty board).
   The bulk-move destination dropdown intentionally still lists all seven
   stages: it is a target picker, not a display module.
7. **Interview questions:** the detail modal has an "Interview questions"
   textarea (one question per line) that saves via the regular card `PATCH`;
   the header **Interview Questions** button opens a read-only dialog listing
   every recorded question grouped by application (company · role header +
   stage badge, blank companies fall back to "Unknown company"). The dialog
   aggregates the already-loaded board state — no extra endpoint — and
   therefore includes applications in hidden stages (hiding is a render
   filter only). Question records are separate from the interview-time field
   (`interview_at`) edited on the interview column.

## Data Model

`Application` (SQLite, `apps/backend/app/models.py`): `application_id` (PK),
`job_id`, `resume_id` (the applied/tailored resume), `master_resume_id`
(optional base — powers the "shared resume" badge), `status` (7-key enum),
`company`, `role`, `applied_at`, `interview_at`, `notes`, `interview_questions`
(JSON list of strings; stored inline so deleting the card deletes its
questions), `position` (per-column order, server-renumbered on PATCH),
`created_at`, `updated_at`. `create_application` dedupes on
`(job_id, resume_id)` to survive double-submit. `interview_at` and
`interview_questions` are added to older databases by idempotent `ALTER TABLE`
migrations in `app/db_engine.py`.

## API (`prefix=/applications`, mounted under `/api/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/applications` | All cards grouped by column (all 7 keys present) |
| POST | `/applications` | Manual add (creates job + card; best-effort extraction) |
| GET | `/applications/{id}` | Card + embedded JD + resume (resume null if deleted) |
| PATCH | `/applications/{id}` | Update status/position/notes/company/role/applied_at/interview_at/interview_questions |
| PATCH | `/applications/bulk` | Move many cards to one column |
| DELETE | `/applications/{id}` | Delete one card |
| POST | `/applications/bulk-delete` | Delete many cards |

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/app/models.py` | `Application` ORM model |
| `apps/backend/app/schemas/applications.py` | Pydantic request/response schemas + status enum |
| `apps/backend/app/routers/applications.py` | The tracker endpoints |
| `apps/backend/app/database.py` | Facade CRUD/bulk/reorder methods |
| `apps/backend/app/routers/resumes.py` | `_auto_create_tracker_application` hook (both confirm paths) |
| `apps/backend/app/services/improver.py` + `app/prompts/templates.py` | Company/role added to keyword extraction |
| `apps/frontend/app/(default)/tracker/page.tsx` | Route |
| `apps/frontend/components/tracker/*` | Board, column, card, detail modal, bulk bar, manual-add dialog |
| `apps/frontend/components/tracker/reorder.ts` | Pure drag-end resolution (`planMove`) |
| `apps/frontend/components/tracker/visibility.ts` | Hidden-stage set: parse/serialize + localStorage I/O |
| `apps/frontend/components/tracker/manage-status-dialog.tsx` | Per-stage visibility switches (Manage dialog) |
| `apps/frontend/components/tracker/interview-questions-dialog.tsx` | Read-only all-questions view (header button) |
| `apps/frontend/lib/api/tracker.ts` | Typed API client |

## Tests

- Backend: `tests/integration/test_applications_api.py` (CRUD, grouping, detail
  tolerance, bulk), `tests/integration/test_tracker_autocreate.py` (confirm
  auto-creates an `applied` card), `tests/unit/test_database.py::TestApplications`.
- Frontend: `tests/tracker-reorder.test.ts` (`planMove` within/cross-column +
  empty-column drop), `tests/api-tracker.test.ts` (client payloads/URLs),
  `tests/tracker-visibility.test.ts` (hidden-set parse/serialize round-trip),
  `tests/tracker-manage-visibility.test.tsx` (Manage dialog hides/persists/
  restores stages without data loss), `tests/tracker-interview-questions.test.tsx`
  (header dialog groups by company/role, unknown-company fallback, empty state,
  hidden-stage questions stay visible).
