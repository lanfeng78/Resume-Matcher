import { APPLICATION_STATUS_ORDER, type ApplicationStatus } from '@/lib/api/tracker';
import { safeStorage } from '@/lib/utils/resume-draft-storage';

// Per-browser preference for which Kanban stages are visible. Only HIDDEN
// stages are stored, so a stage added in a future release stays visible by
// default; unknown keys from a downgraded client are dropped on read.
const STORAGE_KEY = 'resume_matcher_tracker_hidden_statuses';

/** Parse a stored JSON list into a valid hidden-status set. */
export function parseHiddenStatuses(raw: string | null): Set<ApplicationStatus> {
  const hidden = new Set<ApplicationStatus>();
  if (!raw) return hidden;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return hidden;
    for (const value of parsed) {
      if (APPLICATION_STATUS_ORDER.includes(value as ApplicationStatus)) {
        hidden.add(value as ApplicationStatus);
      }
    }
  } catch {
    // Corrupted value (older schema, manual edit) — treat as "nothing hidden"
    // rather than throwing and breaking board load.
  }
  return hidden;
}

export function loadHiddenStatuses(): Set<ApplicationStatus> {
  return parseHiddenStatuses(safeStorage.get(STORAGE_KEY));
}

/** Persist the hidden set in canonical APPLICATION_STATUS_ORDER. */
export function saveHiddenStatuses(hidden: Set<ApplicationStatus>): void {
  const serialized = JSON.stringify(APPLICATION_STATUS_ORDER.filter((s) => hidden.has(s)));
  safeStorage.set(STORAGE_KEY, serialized);
}
