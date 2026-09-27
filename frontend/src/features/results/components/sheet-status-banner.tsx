import { Alert } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/format';
import type { Workbook } from '../api';

export function SheetStatusBanner({ sheet }: { sheet: Workbook['sheet'] }) {
  switch (sheet.status) {
    case 'DRAFT':
      return sheet.returnNote ? (
        <Alert tone="warning" title="Results returned for changes">
          {sheet.returnNote}
          {sheet.returnedAt ? ` (${formatDateTime(sheet.returnedAt)})` : ''} Correct the marks and submit again.
        </Alert>
      ) : null;
    case 'PUBLISHED':
      return <Alert tone="success" title="Results published">Students can see their results{sheet.publishedAt ? ` since ${formatDateTime(sheet.publishedAt)}` : ''}. Marks can no longer change.</Alert>;
    default:
      return (
        <Alert tone="info" title={sheet.status === 'SUBMITTED' ? 'Waiting for the Head of Department' : sheet.status === 'HOD_APPROVED' ? 'Waiting for the Dean' : 'Approved, waiting to be published'}>
          Submitted {sheet.submittedAt ? formatDateTime(sheet.submittedAt) : ''}. Marks are locked unless an approver returns them to you.
        </Alert>
      );
  }
}
