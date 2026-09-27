'use client';

import { useState } from 'react';
import { LOG_GROUP_LABELS } from '@anu/shared';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import type { AuditFilters } from '../api';
import { MODULE_OPTIONS } from '../labels';

interface Props {
  value: AuditFilters;
  onChange: (value: AuditFilters) => void;
  admin?: boolean;
}

export function ActivityFilters({ value, onChange, admin }: Props) {
  const [draft, setDraft] = useState<AuditFilters>(value);
  const set = (k: keyof AuditFilters, v: string) => setDraft((d) => ({ ...d, [k]: v || undefined }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft);
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 print:hidden"
    >
      <div className="lg:col-span-2">
        <Field label={admin ? 'Search person or action' : 'Search actions'} htmlFor="f-search">
          <Input id="f-search" value={draft.search ?? ''} onChange={(e) => set('search', e.target.value)} />
        </Field>
      </div>
      <Field label="From" htmlFor="f-from">
        <Input id="f-from" type="date" value={draft.from ?? ''} onChange={(e) => set('from', e.target.value)} />
      </Field>
      <Field label="To" htmlFor="f-to">
        <Input id="f-to" type="date" value={draft.to ?? ''} onChange={(e) => set('to', e.target.value)} />
      </Field>
      <Field label="Area" htmlFor="f-module">
        <Select id="f-module" value={draft.module ?? ''} onChange={(e) => set('module', e.target.value)}>
          <option value="">All areas</option>
          {MODULE_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      {admin && (
        <Field label="Result" htmlFor="f-result">
          <Select id="f-result" value={draft.result ?? ''} onChange={(e) => set('result', e.target.value)}>
            <option value="">Any result</option>
            <option value="SUCCESS">Succeeded</option>
            <option value="FAILURE">Failed</option>
          </Select>
        </Field>
      )}
      {admin && (
        <Field label="User group" htmlFor="f-group">
          <Select id="f-group" value={draft.group ?? ''} onChange={(e) => set('group', e.target.value)}>
            <option value="">All groups</option>
            {Object.entries(LOG_GROUP_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex items-end gap-2 lg:col-span-6">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft({});
            onChange({});
          }}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
