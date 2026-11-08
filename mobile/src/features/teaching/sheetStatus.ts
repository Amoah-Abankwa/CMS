import type { SheetStatus } from '@/api/results';

/** Where a class's results are in the approval chain, in plain words. */
export const SHEET_STATUS: Record<SheetStatus, string> = {
  DRAFT: 'Not submitted',
  SUBMITTED: 'With the Head of Department',
  HOD_APPROVED: 'With the Dean',
  DEAN_APPROVED: 'Waiting to be published',
  PUBLISHED: 'Published to students',
};
