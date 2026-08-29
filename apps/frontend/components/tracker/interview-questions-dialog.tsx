'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from '@/lib/i18n';
import type { Application } from '@/lib/api/tracker';

interface InterviewQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Every card across the board — including applications in hidden stages,
  // since stage hiding is a render filter only.
  applications: Application[];
}

interface QuestionGroup {
  applicationId: string;
  company: string | null;
  role: string | null;
  status: Application['status'];
  questions: string[];
}

export function InterviewQuestionsDialog({
  open,
  onOpenChange,
  applications,
}: InterviewQuestionsDialogProps) {
  const { t } = useTranslations();

  const groups = useMemo<QuestionGroup[]>(() => {
    return applications
      .filter((app) => (app.interview_questions ?? []).length > 0)
      .map((app) => ({
        applicationId: app.application_id,
        company: app.company,
        role: app.role,
        status: app.status,
        questions: app.interview_questions ?? [],
      }));
  }, [applications]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('tracker.interviewQuestions.title')}</DialogTitle>
          <DialogDescription>{t('tracker.interviewQuestions.description')}</DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <p className="font-serif text-lg text-ink">
              {t('tracker.interviewQuestions.empty.title')}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-soft">
              {t('tracker.interviewQuestions.empty.description')}
            </p>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.applicationId} className="border border-black bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black bg-paper-tint px-3 py-2">
                  <span className="font-serif text-sm font-bold text-ink">
                    {group.company || t('tracker.card.companyUnknown')}
                    <span className="text-steel-grey"> · </span>
                    {group.role || t('tracker.card.roleUnknown')}
                  </span>
                  <span className="border border-black bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                    {t(`tracker.columns.${group.status}`)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 px-3 py-2">
                  {group.questions.map((question, index) => (
                    <li
                      key={`${group.applicationId}-${index}`}
                      className="flex gap-2 text-sm text-ink"
                    >
                      <span className="shrink-0 font-mono text-ink-soft">–</span>
                      <span className="whitespace-pre-wrap">{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
