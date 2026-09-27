'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeTotal, gradeFor, type Mark } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, Spinner } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/axios';
import { resultsApi, type MarkEntry, type Workbook } from '../api';
import { cellKey, MarksGrid, parseCell } from './marks-grid';
import { SchemeEditor } from './scheme-editor';
import { SharePanel } from './share-panel';
import { SheetStatusBanner } from './sheet-status-banner';

function cellsFrom(w: Workbook) {
  const out: Record<string, string> = {};
  for (const m of w.marks) out[cellKey(m.assessmentId, m.studentId)] = m.absent ? 'ABS' : m.score === null ? '' : String(m.score);
  return out;
}

export function MarksWorkbook({ offeringId }: { offeringId: string }) {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [editingScheme, setEditingScheme] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const apply = useCallback((w: Workbook, keepEdits = false) => {
    setWb(w);
    const fresh = cellsFrom(w);
    setSaved(fresh);
    if (!keepEdits) setCells(fresh);
  }, []);

  useEffect(() => {
    resultsApi.workbook(offeringId).then((w) => apply(w)).catch((err) => setError(errorMessage(err)));
  }, [offeringId, apply]);

  const changedKeys = useMemo(() => Object.keys(cells).filter((k) => (cells[k] ?? '') !== (saved[k] ?? '')), [cells, saved]);
  const dirty = changedKeys.length > 0;

  // Warn before leaving the page with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (error && !wb) return <Alert tone="danger">{error}</Alert>;
  if (!wb) return <Spinner />;

  const maxFor = new Map(wb.assessments.map((a) => [a.id, a.maxScore]));
  const invalid = changedKeys.filter((k) => parseCell(cells[k], maxFor.get(k.split(':')[0]) ?? 0).error);

  const saveMarks = async () => {
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const entries: MarkEntry[] = changedKeys.map((k) => {
        const [assessmentId, studentId] = k.split(':');
        const { mark } = parseCell(cells[k], maxFor.get(assessmentId)!);
        return { assessmentId, studentId, score: mark.score, absent: mark.absent };
      });
      apply(await resultsApi.saveMarks(offeringId, entries));
      setNotice(`${entries.length} ${entries.length === 1 ? 'mark' : 'marks'} saved.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy('submit');
    setError(null);
    try {
      apply(await resultsApi.submit(offeringId));
      setConfirmSubmit(false);
      setNotice('Results submitted. The Head of Department has been notified.');
    } catch (err) {
      setConfirmSubmit(false);
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const needsScheme = wb.assessments.length === 0;
  if (wb.students.length === 0) {
    return <EmptyState title="No approved students yet" description="Marks can be entered once students' course registrations are approved." />;
  }

  // Preview numbers for the submit confirmation, calculated exactly as the server will.
  const preview = (() => {
    if (!wb.scale) return null;
    let pass = 0;
    let incomplete = 0;
    let missing = 0;
    for (const s of wb.students) {
      const marks = new Map<string, Mark>(wb.assessments.map((a) => [a.id, parseCell(cells[cellKey(a.id, s.id)] ?? '', a.maxScore).mark]));
      const t = computeTotal(wb.assessments, marks);
      if (t.missing) missing++;
      if (t.incomplete) incomplete++;
      else if (gradeFor(t.total, wb.scale.bands).isPass) pass++;
    }
    return { pass, incomplete, missing };
  })();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${wb.offering.course.code} ${wb.offering.course.title}`}
        description={`${wb.offering.semesterLabel}. ${wb.students.length} students.${wb.isLead ? ' You are the lead lecturer.' : ' The lead lecturer shares marks and submits results.'}`}
      />
      <SheetStatusBanner sheet={wb.sheet} />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {!wb.scale && <Alert tone="warning">No grading scale is set yet, so grades cannot be shown. Ask the Registry.</Alert>}

      {needsScheme || editingScheme ? (
        wb.isLead && wb.canEdit ? (
          <section className="rounded-lg border border-border bg-surface px-4 py-4">
            <SchemeEditor
              workbook={wb}
              onSaved={(w) => {
                apply(w, true);
                setEditingScheme(false);
                setNotice('Assessments saved.');
              }}
              onCancel={needsScheme ? undefined : () => setEditingScheme(false)}
            />
          </section>
        ) : (
          <EmptyState title="Assessments not set up yet" description="The lead lecturer sets how this course is assessed before marks can be entered." />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">Type a mark, or ABS if the student was absent. Press Enter to move to the next student.</p>
            <div className="flex flex-wrap gap-2">
              {wb.isLead && wb.canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditingScheme(true)}>
                  Edit assessments
                </Button>
              )}
              {wb.canEdit && (
                <Button size="sm" onClick={saveMarks} loading={busy === 'save'} disabled={!dirty || invalid.length > 0}>
                  {dirty ? `Save ${changedKeys.length} ${changedKeys.length === 1 ? 'change' : 'changes'}` : 'All marks saved'}
                </Button>
              )}
            </div>
          </div>
          {invalid.length > 0 && <Alert tone="danger">{invalid.length} {invalid.length === 1 ? 'mark needs' : 'marks need'} fixing before you can save. They are highlighted in red.</Alert>}

          <MarksGrid workbook={wb} cells={cells} saved={saved} onCell={(k, v) => setCells((c) => ({ ...c, [k]: v }))} />

          <SharePanel workbook={wb} dirty={dirty} onChanged={(w) => { apply(w); setNotice('Shared. Students have been notified.'); }} onError={setError} />

          {wb.isLead && wb.canEdit && (
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Submit final results</h3>
                <p className="text-xs text-muted">Sends results to the Head of Department, then the Dean, then the Exam Coordinator for publishing. Marks lock while they review.</p>
              </div>
              <Button onClick={() => setConfirmSubmit(true)} disabled={dirty || !wb.scale}>
                Submit results
              </Button>
            </section>
          )}
        </>
      )}

      <Dialog open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Submit results for approval?" description={`${wb.offering.course.code}, ${wb.students.length} students`}>
        <div className="flex flex-col gap-4">
          {preview && (
            <ul className="space-y-1 text-sm">
              <li>{preview.pass} will pass.</li>
              <li>{wb.students.length - preview.pass - preview.incomplete} will fail.</li>
              {preview.incomplete > 0 && <li>{preview.incomplete} marked absent from an exam will get IC (incomplete).</li>}
              {preview.missing > 0 && <li className="text-danger">{preview.missing} still have missing marks. Submitting will be refused until every mark is entered.</li>}
            </ul>
          )}
          <p className="text-sm text-muted">You cannot change marks while the results are being approved, unless an approver returns them.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy === 'submit'}>
              Submit results
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
