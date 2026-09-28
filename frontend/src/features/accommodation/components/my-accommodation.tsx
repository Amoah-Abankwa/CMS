'use client';

import { MyHostelFees } from './hostel-fees';
import { MyHostelForms } from './hostel-paperwork';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { accommodationApi, type MyAccommodation as Data } from '../api';
import { UniversityPanel } from './university-panel';
import { PrivatePanel } from './private-panel';
import { ResidencePanel } from './residence-panel';

const TABS = [
  { value: 'university', label: 'University hostel' },
  { value: 'private', label: 'Private hostels' },
  { value: 'residence', label: 'Where I live' },
] as const;

export function MyAccommodation() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('university');

  const load = () => accommodationApi.mine().then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">

    <MyHostelFees />
      <MyHostelForms />
      <div role="tablist" aria-label="Accommodation" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.value} role="tab" type="button" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', tab === t.value ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'university' && <UniversityPanel data={data} onChange={load} />}
      {tab === 'private' && <PrivatePanel data={data} onChange={load} />}
      {tab === 'residence' && <ResidencePanel data={data} onChange={load} />}
    </div>
  );
}
