'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import { accommodationApi, RESIDENCE_LABEL, type MyAccommodation } from '../api';

/** Where the student lives this semester, and a form for students living off campus. */
export function ResidencePanel({ data, onChange }: { data: MyAccommodation; onChange: () => void }) {
  const [address, setAddress] = useState('');
  const [digital, setDigital] = useState('');
  const [landmark, setLandmark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAddress(data.declaration?.address ?? '');
    setDigital(data.declaration?.digitalAddress ?? '');
    setLandmark(data.declaration?.landmark ?? '');
  }, [data.declaration]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await accommodationApi.declare({ address: address.trim(), digitalAddress: digital.trim() || undefined, landmark: landmark.trim() || undefined });
      setSaved(true);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onCampus = data.residence.kind === 'UNIVERSITY' || data.residence.kind === 'PRIVATE';
  return (
    <Card>
      <CardHeader title="Where you live" description={`${data.semester.label}. The Dean of Students and Security use this to reach you in an emergency.`} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm">
          <span className="font-medium">{RESIDENCE_LABEL[data.residence.kind]}</span>
          {data.residence.label ? `: ${data.residence.label}` : ''}
        </p>
        {onCampus ? (
          <p className="text-sm text-muted">This comes from your hostel place, so there is nothing to fill in.</p>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-4">
            <p className="text-sm text-muted">Living with family or in a room you rent yourself? Tell us where.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            {saved && <Alert tone="success">Saved.</Alert>}
            <Field label="Address" htmlFor="res-address"><Input id="res-address" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GhanaPost digital address (optional)" htmlFor="res-digital" hint="For example EN-012-3456."><Input id="res-digital" autoCapitalize="characters" value={digital} onChange={(e) => setDigital(e.target.value.toUpperCase())} /></Field>
              <Field label="Nearby landmark (optional)" htmlFor="res-landmark"><Input id="res-landmark" value={landmark} maxLength={120} onChange={(e) => setLandmark(e.target.value)} /></Field>
            </div>
            <div><Button type="submit" loading={busy} disabled={address.trim().length < 5}>Save where I live</Button></div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
