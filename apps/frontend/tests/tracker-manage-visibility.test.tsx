import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanBoard } from '@/components/tracker/kanban-board';
import {
  APPLICATION_STATUS_ORDER,
  type Application,
  type ApplicationStatus,
} from '@/lib/api/tracker';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

const listApplications = vi.fn();
vi.mock('@/lib/api/tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/tracker')>();
  return { ...actual, listApplications: (...args: unknown[]) => listApplications(...args) };
});

// Modal children hit their own API/context layers; the board keeps them
// mounted, so stub them out — visibility logic under test lives on the board.
vi.mock('@/components/tracker/card-detail-modal', () => ({ CardDetailModal: () => null }));
vi.mock('@/components/tracker/manual-add-application-dialog', () => ({
  ManualAddApplicationDialog: () => null,
}));

// dnd-kit measures droppables with ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

const STORAGE_KEY = 'resume_matcher_tracker_hidden_statuses';

function mkApp(status: ApplicationStatus, id: string, company: string): Application {
  return {
    application_id: id,
    job_id: `job-${id}`,
    resume_id: `res-${id}`,
    master_resume_id: null,
    status,
    company,
    role: 'Engineer',
    applied_at: null,
    notes: null,
    interview_questions: [],
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function mockBoardResponse() {
  listApplications.mockResolvedValue({
    columns: {
      saved: [mkApp('saved', 'a1', 'Acme')],
      interview: [mkApp('interview', 'a2', 'Globex')],
    },
  });
}

async function renderLoadedBoard() {
  const view = render(<KanbanBoard />);
  await waitFor(() => {
    expect(view.container.querySelector('[data-column="saved"]')).not.toBeNull();
  });
  return view;
}

function openManageDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'tracker.manage' }));
  const switches = screen.getAllByRole('switch');
  expect(switches).toHaveLength(APPLICATION_STATUS_ORDER.length);
  return switches;
}

function switchForStatus(switches: HTMLElement[], status: ApplicationStatus) {
  const index = APPLICATION_STATUS_ORDER.indexOf(status);
  const sw = switches[index];
  const label = document.getElementById(sw.getAttribute('aria-labelledby') ?? '');
  expect(label?.textContent).toBe(`tracker.columns.${status}`);
  return sw;
}

beforeEach(() => {
  localStorage.clear();
  listApplications.mockReset();
});

describe('KanbanBoard stage visibility management', () => {
  it('hides a stage via the Manage dialog without deleting its data', async () => {
    mockBoardResponse();
    const { container } = await renderLoadedBoard();

    const switches = openManageDialog();
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(switchForStatus(switches, 'saved'));

    // Hidden stage is no longer rendered...
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).toBeNull();
    });
    expect(container.querySelector('[data-column="interview"]')).not.toBeNull();
    expect(screen.queryByText('Acme')).toBeNull();

    // ...and the choice is persisted.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('["saved"]');

    // Re-show: the card comes back untouched — hiding never deleted data.
    fireEvent.click(switchForStatus(screen.getAllByRole('switch'), 'saved'));
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).not.toBeNull();
    });
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('keeps the hidden choice across a full remount (page refresh)', async () => {
    mockBoardResponse();
    const first = await renderLoadedBoard();

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manage' }));
    fireEvent.click(switchForStatus(screen.getAllByRole('switch'), 'saved'));
    await waitFor(() => {
      expect(first.container.querySelector('[data-column="saved"]')).toBeNull();
    });
    first.unmount();

    const second = render(<KanbanBoard />);
    await waitFor(() => {
      expect(second.container.querySelector('[data-column="interview"]')).not.toBeNull();
    });
    expect(second.container.querySelector('[data-column="saved"]')).toBeNull();
    expect(listApplications).toHaveBeenCalledTimes(2);
  });

  it('shows an all-hidden hint instead of an empty board when every stage is off', async () => {
    mockBoardResponse();
    const { container } = await renderLoadedBoard();

    const switches = openManageDialog();
    for (const sw of switches) fireEvent.click(sw);

    expect(screen.getByText('tracker.allHidden.title')).toBeTruthy();
    expect(container.querySelectorAll('[data-column]')).toHaveLength(0);

    // Board is not mistaken for "no applications": data reload still happens
    // and restoring one stage brings its column straight back.
    fireEvent.click(switchForStatus(screen.getAllByRole('switch'), 'interview'));
    await waitFor(() => {
      expect(container.querySelector('[data-column="interview"]')).not.toBeNull();
    });
    expect(screen.getByText('Globex')).toBeTruthy();
  });
});
