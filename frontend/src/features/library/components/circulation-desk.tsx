'use client';

import { useRef, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { dueLabel, libraryApi, type BorrowerRow, type BorrowerSummary } from '../api';

type LogEntry = { key: number; text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' };
const add = (set: React.Dispatch<React.SetStateAction<LogEntry[]>>, text: string, tone: LogEntry['tone']) =>
  set((l) => [{ key: Date.now() + Math.random(), text, tone }, ...l].slice(0, 8));

function Log({ entries }: { entries: LogEntry[] }) {
  if (!entries.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1" aria-live="polite">
      {entries.map((e, i) => (
        <li key={e.key} className={cn('rounded px-2 py-1 text-sm', i === 0 && 'font-medium', e.tone === 'success' && 'bg-success-soft', e.tone === 'warning' && 'bg-warning-soft', e.tone === 'danger' && 'bg-danger-soft')}>{e.text}</li>
      ))}
    </ul>
  );
}

/**
 * Borrow: find the person, then scan each book. Return: scan the book; nothing else needed.
 * Inputs clear and keep focus after each scan so a queue moves quickly.
 */
export function CirculationDesk() {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<BorrowerRow[] | null>(null);
  const [summary, setSummary] = useState<BorrowerSummary | null>(null);
  const [issueCode, setIssueCode] = useState('');
  const [returnCode, setReturnCode] = useState('');
  const [issueLog, setIssueLog] = useState<LogEntry[]>([]);
  const [returnLog, setReturnLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [losing, setLosing] = useState<BorrowerSummary['loans'][number] | null>(null);
  const issueInput = useRef<HTMLInputElement>(null);
  const returnInput = useRef<HTMLInputElement>(null);

  const open = async (id: string) => {
    setError(null);
    try {
      setSummary(await libraryApi.borrower(id));
      setMatches(null);
      setIssueLog([]);
      window.setTimeout(() => issueInput.current?.focus(), 50);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setError(null);
    try {
      const rows = await libraryApi.lookup(q.trim());
      if (rows.length === 1) await open(rows[0].id);
      else setMatches(rows);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = issueCode.trim().toUpperCase();
    if (!code || !summary) return;
    setIssueCode('');
    setBusy('issue');
    try {
      const r = await libraryApi.issue(summary.borrower.id, code);
      add(setIssueLog, `${r.title}: due ${dueLabel(r.dueAt)}`, 'success');
      setSummary(await libraryApi.borrower(summary.borrower.id));
    } catch (err) {
      add(setIssueLog, `${code}: ${errorMessage(err)}`, 'danger');
    } finally {
      setBusy(null);
      issueInput.current?.focus();
    }
  };

  const giveBack = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = returnCode.trim().toUpperCase();
    if (!code) return;
    setReturnCode('');
    setBusy('return');
    try {
      const r = await libraryApi.returnCopy(code);
      const who = `${r.borrower.firstName} ${r.borrower.lastName}`;
      const parts = [`${r.title} returned by ${who}`];
      if (r.daysLate) parts.push(`${r.daysLate} days late`);
      if (r.fine) parts.push(`fined ${formatCedis(r.fine)}`);
      if (r.foundAfterLost) parts.push('it had been declared lost; waive the lost-book fee if appropriate');
      if (r.heldFor) parts.push(`reserved for ${r.heldFor}`);
      add(setReturnLog, parts.join('. ') + '.', r.heldFor ? 'warning' : r.fine ? 'warning' : 'success');
      if (summary) setSummary(await libraryApi.borrower(summary.borrower.id));
    } catch (err) {
      add(setReturnLog, `${code}: ${errorMessage(err)}`, 'danger');
    } finally {
      setBusy(null);
      returnInput.current?.focus();
    }
  };

  const renew = async (loanId: string) => {
    if (!summary) return;
    setBusy(loanId);
    try {
      const r = await libraryApi.deskRenew(loanId);
      add(setIssueLog, `Renewed until ${dueLabel(r.dueAt)}. ${r.renewalsLeft} renewals left.`, 'success');
      setSummary(await libraryApi.borrower(summary.borrower.id));
    } catch (err) {
      add(setIssueLog, errorMessage(err), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const markLost = async () => {
    if (!losing || !summary) return;
    setBusy('lost');
    try {
      const r = await libraryApi.lost(losing.id);
      add(setIssueLog, `${losing.copy.title.title} marked lost.${r.fee ? ` Replacement fee ${formatCedis(r.fee)} charged.` : ''}`, 'warning');
      setLosing(null);
      setSummary(await libraryApi.borrower(summary.borrower.id));
    } catch (err) {
      add(setIssueLog, errorMessage(err), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const b = summary?.borrower;
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader title="Borrow" description="Find the borrower by index number, staff number, email or name." />
        <CardBody className="flex flex-col gap-4">
          <form onSubmit={find} className="flex gap-2">
            <Input aria-label="Find borrower" autoFocus autoComplete="off" placeholder="ANU26400006 or name" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="secondary">Find</Button>
          </form>
          {error && <Alert tone="danger">{error}</Alert>}
          {matches && (matches.length === 0 ? <p className="text-sm text-muted">Nobody matches.</p> : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {matches.map((m) => (
                <li key={m.id}><button type="button" onClick={() => open(m.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-surface-muted">{m.firstName} {m.lastName} <span className="text-xs text-muted">{m.indexNumber ?? m.staffProfile?.staffNumber ?? m.email}</span></button></li>
              ))}
            </ul>
          ))}

          {summary && b && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{b.firstName} {b.lastName}</p>
                  <p className="text-sm text-muted">{b.indexNumber ?? b.staffProfile?.staffNumber} {b.kind === 'STUDENT' ? `, ${b.studentProfile?.programme.name}` : ', staff'}. {summary.loans.length} of {summary.rules.maxItems} books, {summary.rules.loanDays}-day loans.</p>
                </div>
                {summary.owed > 0 && <Badge tone="danger">Owes {formatCedis(summary.owed)}</Badge>}
              </div>
              {summary.blocks.length > 0 && <Alert tone="danger" title="Cannot borrow">{summary.blocks.join('. ')}.</Alert>}
              {summary.reservations.filter((r) => r.status === 'READY').map((r) => (
                <Alert key={r.id} tone="success">Reserved book waiting: &ldquo;{r.title.title}&rdquo;, copy {r.copy?.barcode}. Scan it to issue.</Alert>
              ))}
              <form onSubmit={issue} className="flex gap-2">
                <Input ref={issueInput} aria-label="Scan book barcode to issue" autoComplete="off" className="font-mono uppercase" placeholder="Scan book barcode" value={issueCode} onChange={(e) => setIssueCode(e.target.value)} disabled={summary.blocks.length > 0} />
                <Button type="submit" loading={busy === 'issue'} disabled={summary.blocks.length > 0}>Issue</Button>
              </form>
              <Log entries={issueLog} />
              {summary.loans.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {summary.loans.map((l) => (
                    <li key={l.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 text-sm">
                        {l.copy.title.title} <span className="font-mono text-xs text-muted">{l.copy.barcode}</span>
                        <span className={cn('block text-xs', l.overdueDays ? 'font-medium text-danger' : 'text-muted')}>
                          {l.overdueDays ? `${l.overdueDays} days overdue, ${formatCedis(l.fineSoFar)} so far` : `Due ${dueLabel(l.dueAt)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" disabled={!l.canRenew} title={l.renewBlock ?? undefined} loading={busy === l.id} onClick={() => renew(l.id)}>Renew</Button>
                        <Button variant="ghost" size="sm" onClick={() => setLosing(l)}>Lost</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Return" description="Scan the book. Late fines and reservations are handled automatically." />
        <CardBody>
          <form onSubmit={giveBack} className="flex gap-2">
            <Input ref={returnInput} aria-label="Scan book barcode to return" autoComplete="off" className="font-mono uppercase" placeholder="Scan book barcode" value={returnCode} onChange={(e) => setReturnCode(e.target.value)} />
            <Button type="submit" loading={busy === 'return'}>Return</Button>
          </form>
          <Log entries={returnLog} />
        </CardBody>
      </Card>

      <Dialog open={!!losing} onClose={() => setLosing(null)} title="Mark this book as lost?" description={losing ? `${losing.copy.title.title}, copy ${losing.copy.barcode}` : ''}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">The borrower is charged the replacement fee and the copy is marked lost. If it turns up later, return it as normal and waive the fee on the Library fines page.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLosing(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === 'lost'} onClick={markLost}>Mark as lost</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
