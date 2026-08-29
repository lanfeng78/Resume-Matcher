import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadHiddenStatuses,
  parseHiddenStatuses,
  saveHiddenStatuses,
} from '@/components/tracker/visibility';

const STORAGE_KEY = 'resume_matcher_tracker_hidden_statuses';

beforeEach(() => {
  localStorage.clear();
});

describe('parseHiddenStatuses', () => {
  it('returns an empty set for null/empty storage', () => {
    expect(parseHiddenStatuses(null)).toEqual(new Set());
    expect(parseHiddenStatuses('')).toEqual(new Set());
  });

  it('returns an empty set for corrupted JSON or non-array values', () => {
    expect(parseHiddenStatuses('not json {')).toEqual(new Set());
    expect(parseHiddenStatuses('{"saved":true}')).toEqual(new Set());
    expect(parseHiddenStatuses('42')).toEqual(new Set());
  });

  it('keeps known status keys and drops unknown ones', () => {
    expect(parseHiddenStatuses('["saved","bogus","rejected"]')).toEqual(
      new Set(['saved', 'rejected'])
    );
  });
});

describe('saveHiddenStatuses / loadHiddenStatuses round-trip', () => {
  it('persists the hidden set in canonical APPLICATION_STATUS_ORDER', () => {
    saveHiddenStatuses(new Set(['rejected', 'saved']));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('["saved","rejected"]');
    expect(loadHiddenStatuses()).toEqual(new Set(['saved', 'rejected']));
  });

  it('persists an empty set when nothing is hidden', () => {
    saveHiddenStatuses(new Set());
    expect(loadHiddenStatuses()).toEqual(new Set());
  });

  it('ignores unknown keys injected into storage', () => {
    localStorage.setItem(STORAGE_KEY, '["archived","interview"]');
    expect(loadHiddenStatuses()).toEqual(new Set(['interview']));
  });
});
