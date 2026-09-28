'use client';

import { useEffect, useState } from 'react';
import { FEE_METHOD_LABEL, formatMoney } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate, formatDateTime } from '@/lib/format';
import { feesApi, type FeeReceipt, type MyBill } from '../api';
import { PdfLink } from './pdf-link';

/** Printing opens the browser's dialog, where "Save as PDF" gives a PDF copy. */
function PrintBar({ label, pdf }: { label: string; pdf: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <a href={`/api/v1${pdf}`} download className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:opacity-90">Download PDF</a>
      <Button variant="secondary" onClick={() => window.print()}>{label}</Button>
    </div>
  );
}

function Letterhead({ title }: { title: string }) {
  return (
    <div className="mb-4 border-b border-border pb-3 print:border-black">
      <p className="text-lg font-bold">All Nations University</p>
      <p className="text-sm">Koforidua, Ghana. Finance Office.</p>
      <p className="mt-2 text-base font-semibold">{title}</p>
    </div>
  );
}

export function FeeReceiptView({ id, admin }: { id: string; admin?: boolean }) {
  const [r, setR] = useState<FeeReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { (admin ? feesApi.adminReceipt(id) : feesApi.myReceipt(id)).then(setR).catch((err) => setError(errorMessage(err))); }, [id, admin]);
  if (!r) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const rows: Array<[string, string]> = [
    ['Receipt number', r.receiptNumber],
    ['Student', `${r.student.name} (${r.student.indexNumber ?? ''})`],
    ['Programme', `${r.student.programme ?? ''}${r.student.level ? `, level ${r.student.level}` : ''}`],
    ['Fees for', r.semester],
    ['Amount received', formatMoney(r.amount, r.currency)],
    ...(r.originalAmount && r.originalCurrency ? [['Paid as', `${formatMoney(r.originalAmount, r.originalCurrency)} at ${r.exchangeRate} cedis per dollar`] as [string, string]] : []),
    ['Paid by', FEE_METHOD_LABEL[r.method]],
    ['Reference', r.reference],
    ['Date paid', formatDate(r.paidOn)],
    ['Balance after this payment', formatMoney(Math.max(0, r.balanceAfter), r.currency)],
  ];
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PrintBar label="Print" pdf={admin ? `/fees/payments/${id}/receipt/pdf` : `/me/fees/receipts/${id}/pdf`} />
      <div className="rounded-lg border border-border bg-surface p-6 print:border-0 print:p-0">
        <Letterhead title="Official receipt: school fees" />
        {r.reversedAt && <Alert tone="danger">This payment was reversed on {formatDate(r.reversedAt)}: {r.reversalReason}. This receipt is no longer valid.</Alert>}
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted print:text-black">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        <p className="mt-6 text-xs text-muted print:text-black">Generated {formatDateTime(new Date())} from the ANU platform. Check it at the Finance Office by its receipt number.</p>
      </div>
    </div>
  );
}

export function FeeStatementView({ billId }: { billId: string }) {
  const [bill, setBill] = useState<MyBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { feesApi.mine().then((d) => { const b = d.bills.find((x) => x.id === billId); if (b) setBill(b); else setError('Statement not found.'); }).catch((err) => setError(errorMessage(err))); }, [billId]);
  if (!bill) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const m = (n: number) => (n ? formatMoney(n, bill.currency) : '');
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PrintBar label="Print" pdf={`/me/fees/statements/${billId}/pdf`} />
      <div className="rounded-lg border border-border bg-surface p-6 print:border-0 print:p-0">
        <Letterhead title={`Fees statement: ${bill.semesterLabel}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-xs text-muted print:text-black">
              <tr className="border-b border-border print:border-black"><th className="py-1.5 pr-3 font-medium">Date</th><th className="py-1.5 pr-3 font-medium">Details</th><th className="py-1.5 pr-3 text-right font-medium">Debit</th><th className="py-1.5 pr-3 text-right font-medium">Credit</th><th className="py-1.5 text-right font-medium">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bill.statement.map((e, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="py-1.5 pr-3">{e.description}{e.receipt ? <span className="block text-xs text-muted print:text-black">Receipt {e.receipt}</span> : null}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{m(e.debit)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{m(e.credit)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(e.balance, bill.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-border font-semibold print:border-black"><td colSpan={4} className="py-2 pr-3">Balance {bill.balance < 0 ? 'in your favour' : 'owed'}</td><td className="py-2 text-right tabular-nums">{formatMoney(Math.abs(bill.balance), bill.currency)}</td></tr></tfoot>
          </table>
        </div>
        <p className="mt-6 text-xs text-muted print:text-black">Generated {formatDateTime(new Date())} from the ANU platform.</p>
      </div>
    </div>
  );
}
