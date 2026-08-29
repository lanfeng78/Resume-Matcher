import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDetailModal } from '@/components/tracker/card-detail-modal';
import type { ApplicationDetail } from '@/lib/api/tracker';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const getApplicationDetail = vi.fn();
const updateApplication = vi.fn();
vi.mock('@/lib/api/tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/tracker')>();
  return {
    ...actual,
    getApplicationDetail: (...args: unknown[]) => getApplicationDetail(...args),
    updateApplication: (...args: unknown[]) => updateApplication(...args),
  };
});

function mkDetail(overrides: Partial<ApplicationDetail>): ApplicationDetail {
  return {
    application_id: 'a1',
    job_id: 'job-a1',
    resume_id: 'res-a1',
    master_resume_id: null,
    status: 'interview',
    company: 'Globex',
    role: 'Engineer',
    applied_at: '2026-08-01T00:00:00Z',
    interview_at: null,
    notes: null,
    interview_questions: [],
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    job_content: 'JD',
    resume: { resume_id: 'res-a1' },
    ...overrides,
  };
}

function renderModal() {
  const onUpdated = vi.fn();
  render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={onUpdated} />);
  return { onUpdated };
}

const saveButton = () => screen.getByRole('button', { name: 'tracker.modal.saveInterviewTime' });

beforeEach(() => {
  getApplicationDetail.mockReset();
  updateApplication.mockReset();
  updateApplication.mockResolvedValue(mkDetail({}));
});

describe('CardDetailModal interview time', () => {
  it('offers a datetime editor on interview cards and persists the value', async () => {
    getApplicationDetail.mockResolvedValue(mkDetail({}));
    const { onUpdated } = renderModal();

    const input = (await screen.findByLabelText('tracker.modal.interviewTime')) as HTMLInputElement;
    expect(input.type).toBe('datetime-local');

    fireEvent.change(input, { target: { value: '2026-09-05T14:30' } });
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(updateApplication).toHaveBeenCalledWith('a1', { interview_at: '2026-09-05T14:30' });
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it('loads a previously saved interview time back into the editor', async () => {
    getApplicationDetail.mockResolvedValue(mkDetail({ interview_at: '2026-09-05T14:30' }));
    renderModal();

    await waitFor(() => {
      const input = screen.getByLabelText('tracker.modal.interviewTime') as HTMLInputElement;
      expect(input.value).toBe('2026-09-05T14:30');
    });
  });

  it('sends null (clear) when the input is emptied', async () => {
    getApplicationDetail.mockResolvedValue(mkDetail({ interview_at: '2026-09-05T14:30' }));
    renderModal();

    const input = await screen.findByLabelText('tracker.modal.interviewTime');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(updateApplication).toHaveBeenCalledWith('a1', { interview_at: null });
    });
  });

  it('hides the editor outside the interview stage', async () => {
    getApplicationDetail.mockResolvedValue(mkDetail({ status: 'applied' }));
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('tracker.modal.jobDescription')).toBeTruthy();
    });
    expect(screen.queryByLabelText('tracker.modal.interviewTime')).toBeNull();
  });
});
