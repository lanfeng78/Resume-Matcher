import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanBoard } from '@/components/tracker/kanban-board';
import type { Application, ApplicationStatus } from '@/lib/api/tracker';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

const listApplications = vi.fn();
vi.mock('@/lib/api/tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/tracker')>();
  return { ...actual, listApplications: (...args: unknown[]) => listApplications(...args) };
});

// Modal children hit their own API/context layers; the board keeps them
// mounted, so stub them out — the dialog under test needs none of them.
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

function mkApp(
  status: ApplicationStatus,
  id: string,
  company: string | null,
  interviewQuestions: string[] = []
): Application {
  return {
    application_id: id,
    job_id: `job-${id}`,
    resume_id: `res-${id}`,
    master_resume_id: null,
    status,
    company,
    role: `Role ${id}`,
    applied_at: null,
    notes: null,
    interview_questions: interviewQuestions,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

async function openQuestionsDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'tracker.interviewQuestions.button' }));
  // Scoped by accessible name: other dialogs (e.g. Manage) may still be open.
  return screen.findByRole('dialog', { name: 'tracker.interviewQuestions.title' });
}

beforeEach(() => {
  localStorage.clear();
  listApplications.mockReset();
});

describe('InterviewQuestionsDialog', () => {
  it('opens from the header button and groups questions by company and role', async () => {
    listApplications.mockResolvedValue({
      columns: {
        saved: [mkApp('saved', 'a1', 'Acme', ['Walk through a past project'])],
        interview: [mkApp('interview', 'a2', 'Globex', ['How do you debug prod incidents?'])],
      },
    });
    const { container } = render(<KanbanBoard />);
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).not.toBeNull();
    });

    const dialog = await openQuestionsDialog();
    expect(screen.getByText('tracker.interviewQuestions.title')).toBeTruthy();
    // Company · role headers render per application with its stage badge.
    expect(dialog.textContent).toContain('Acme');
    expect(dialog.textContent).toContain('Role a1');
    expect(dialog.textContent).toContain('Walk through a past project');
    expect(dialog.textContent).toContain('Globex');
    expect(dialog.textContent).toContain('How do you debug prod incidents?');
  });

  it('falls back to unknown-company copy when the company is blank', async () => {
    listApplications.mockResolvedValue({
      columns: {
        applied: [mkApp('applied', 'a1', null, ['q1'])],
      },
    });
    const { container } = render(<KanbanBoard />);
    await waitFor(() => {
      expect(container.querySelector('[data-column="applied"]')).not.toBeNull();
    });

    const dialog = await openQuestionsDialog();
    expect(dialog.textContent).toContain('tracker.card.companyUnknown');
    expect(dialog.textContent).toContain('q1');
  });

  it('lists only applications that have questions and shows an empty state otherwise', async () => {
    listApplications.mockResolvedValue({
      columns: {
        saved: [mkApp('saved', 'a1', 'Acme')],
        applied: [mkApp('applied', 'a2', 'Globex', ['q2'])],
      },
    });
    const { container } = render(<KanbanBoard />);
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).not.toBeNull();
    });

    const dialog = await openQuestionsDialog();
    expect(dialog.textContent).toContain('Globex');
    expect(dialog.textContent).toContain('q2');
    expect(dialog.textContent).not.toContain('Acme');
  });

  it('shows the empty state when no questions were recorded anywhere', async () => {
    listApplications.mockResolvedValue({
      columns: {
        saved: [mkApp('saved', 'a1', 'Acme')],
      },
    });
    const { container } = render(<KanbanBoard />);
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).not.toBeNull();
    });

    const dialog = await openQuestionsDialog();
    expect(screen.getByText('tracker.interviewQuestions.empty.title')).toBeTruthy();
    expect(dialog.textContent).not.toContain('Acme');
  });

  it('keeps questions from a hidden stage visible (hiding is a render filter only)', async () => {
    listApplications.mockResolvedValue({
      columns: {
        saved: [mkApp('saved', 'a1', 'Acme', ['q1'])],
      },
    });
    const { container } = render(<KanbanBoard />);
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).not.toBeNull();
    });

    // Hide the "saved" stage through the Manage dialog.
    fireEvent.click(screen.getByRole('button', { name: 'tracker.manage' }));
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-column="saved"]')).toBeNull();
    });

    const dialog = await openQuestionsDialog();
    expect(dialog.textContent).toContain('Acme');
    expect(dialog.textContent).toContain('q1');
  });
});
