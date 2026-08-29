'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useTranslations } from '@/lib/i18n';
import { APPLICATION_STATUS_ORDER, type ApplicationStatus } from '@/lib/api/tracker';

interface ManageStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hiddenStatuses: Set<ApplicationStatus>;
  onToggle: (status: ApplicationStatus, visible: boolean) => void;
}

export function ManageStatusDialog({
  open,
  onOpenChange,
  hiddenStatuses,
  onToggle,
}: ManageStatusDialogProps) {
  const { t } = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tracker.manageModal.title')}</DialogTitle>
          <DialogDescription>{t('tracker.manageModal.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {APPLICATION_STATUS_ORDER.map((status) => (
            <ToggleSwitch
              key={status}
              checked={!hiddenStatuses.has(status)}
              onCheckedChange={(visible) => onToggle(status, visible)}
              label={t(`tracker.columns.${status}`)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
