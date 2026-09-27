'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { accommodationApi, type MyAccommodation } from '../api';

type Pref = { hostelId: string; roomType: string };

/** Apply for a university hostel, then respond to the offer. */
export function UniversityPanel({ data, onChange }: { data: MyAccommodation; onChange: () => void }) {
  const app = data.application;
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [acceptAny, setAcceptAny] = useState(true);
  const [needs, setNeeds] = useState('');
  const [gender, setGender] = useState<'' | 'Female' | 'Male'>('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(app ? app.preferences.map((p) => ({ hostelId: p.hostelId, roomType: p.roomType ?? '' })) : [{ hostelId: '', roomType: '' }]);
    setAcceptAny(app?.acceptAny ?? true);
    setNeeds(app?.specialNeeds ?? '');
  }, [app]);

  const run = async (kind: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      setEditing(false);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const a = data.allocation;
  if (a) {
    return (
      <Card>
        <CardHeader title={a.status === 'ACCEPTED' ? 'Your hostel room' : 'You have a hostel offer'} description={data.semester.label} />
        <CardBody className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <p className="text-xl font-semibold">{a.room.hostel.name}, room {a.room.number}</p>
            <p className="text-sm text-muted">
              {a.room.roomType}{a.room.floor ? `, floor ${a.room.floor}` : ''}{a.room.hostel.location ? `, ${a.room.hostel.location}` : ''}. {formatCedis(a.room.pricePerSemester)} per semester.
            </p>
          </div>
          {a.status === 'OFFERED' ? (
            <>
              <Alert tone="warning">Accept or decline by {a.acceptBy ? formatDateTime(a.acceptBy) : 'the deadline'}. If you do not reply, the bed goes to the next student waiting.</Alert>
              <div className="flex flex-wrap gap-2">
                <Button loading={busy === 'accept'} onClick={() => run('accept', () => accommodationApi.respond(true), 'Room accepted.')}>Accept this room</Button>
                <Button variant="secondary" loading={busy === 'decline'} onClick={() => run('decline', () => accommodationApi.respond(false), 'Offer declined. The bed will go to someone waiting.')}>Decline</Button>
              </div>
            </>
          ) : (
            <Badge tone="success">Accepted</Badge>
          )}
        </CardBody>
      </Card>
    );
  }

  const status = app?.status;
  const canEdit = data.applicationsOpen && (!app || status === 'SUBMITTED' || status === 'WITHDRAWN');
  const showForm = canEdit && (!app || status === 'WITHDRAWN' || editing);

  return (
    <Card>
      <CardHeader
        title="University hostel"
        description={data.round ? `Applications for ${data.semester.label}: ${formatDateTime(data.round.opensAt)} to ${formatDateTime(data.round.closesAt)}.` : 'Applications have not opened for this semester.'}
      />
      <CardBody className="flex flex-col gap-4">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        {app && status !== 'WITHDRAWN' && !showForm && (
          <div className="flex flex-col gap-3">
            {status === 'SUBMITTED' && <Alert tone="info" title="Application received">You will get an email and SMS when rooms are offered. First-year, final-year and confirmed special-needs students are placed first.</Alert>}
            {status === 'UNPLACED' && <Alert tone="warning" title="On the waiting list">No bed in your chosen hostels this round. You will be offered one if a bed becomes free. You can also look at verified private hostels.</Alert>}
            <ol className="list-decimal pl-5 text-sm">
              {app.preferences.map((p) => <li key={p.hostelId}>{data.hostels.find((h) => h.id === p.hostelId)?.name ?? 'Hostel'}{p.roomType ? `, ${p.roomType}` : ''}</li>)}
            </ol>
            <p className="text-xs text-muted">{app.acceptAny ? 'Any hostel if these are full.' : 'Only these hostels.'} {app.specialNeeds ? (app.specialNeedsApproved ? 'Special need confirmed by the Hostel Office.' : 'Special need waiting for the Hostel Office to confirm.') : ''}</p>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Change choices</Button>
                <Button variant="ghost" size="sm" loading={busy === 'withdraw'} onClick={() => run('withdraw', () => accommodationApi.withdraw(), 'Application withdrawn.')}>Withdraw</Button>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                'apply',
                () => accommodationApi.apply({
                  preferences: prefs.filter((p) => p.hostelId).map((p) => ({ hostelId: p.hostelId, roomType: p.roomType || null })),
                  acceptAny,
                  specialNeeds: needs.trim() || undefined,
                  gender: gender || undefined,
                }),
                'Application submitted.',
              );
            }}
            className="flex flex-col gap-4"
          >
            {!data.gender && (
              <Field label="Halls for" htmlFor="app-gender" hint="University halls are single-gender. This is saved to your student record.">
                <Select id="app-gender" value={gender} onChange={(e) => setGender(e.target.value as 'Female')}>
                  <option value="">Choose</option>
                  <option value="Female">Female students</option>
                  <option value="Male">Male students</option>
                </Select>
              </Field>
            )}
            {prefs.map((p, i) => {
              const hostel = data.hostels.find((h) => h.id === p.hostelId);
              return (
                <div key={i} className="grid gap-3 sm:grid-cols-2">
                  <Field label={`Choice ${i + 1}`} htmlFor={`pref-${i}`}>
                    <Select id={`pref-${i}`} value={p.hostelId} onChange={(e) => setPrefs((ps) => ps.map((x, j) => (j === i ? { hostelId: e.target.value, roomType: '' } : x)))}>
                      <option value="">{i === 0 ? 'Choose a hostel' : 'No further choice'}</option>
                      {data.hostels.filter((h) => h.id === p.hostelId || !prefs.some((x) => x.hostelId === h.id)).map((h) => (
                        <option key={h.id} value={h.id}>{h.name}{h.location ? `, ${h.location}` : ''}</option>
                      ))}
                    </Select>
                  </Field>
                  {hostel && (
                    <Field label="Room type" htmlFor={`type-${i}`}>
                      <Select id={`type-${i}`} value={p.roomType} onChange={(e) => setPrefs((ps) => ps.map((x, j) => (j === i ? { ...x, roomType: e.target.value } : x)))}>
                        <option value="">Any room type</option>
                        {hostel.roomTypes.map((t) => <option key={t.roomType} value={t.roomType}>{t.roomType}, {formatCedis(t.pricePerSemester)}</option>)}
                      </Select>
                    </Field>
                  )}
                </div>
              );
            })}
            {prefs.length < 3 && prefs[prefs.length - 1]?.hostelId && (
              <div><Button variant="ghost" size="sm" onClick={() => setPrefs((ps) => [...ps, { hostelId: '', roomType: '' }])}>Add another choice</Button></div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" checked={acceptAny} onChange={(e) => setAcceptAny(e.target.checked)} />
              If my choices are full, place me in any suitable hostel.
            </label>
            <Field label="Medical or disability need (optional)" htmlFor="app-needs" hint="Only the Hostel Office sees this. Once confirmed, you are placed first.">
              <Textarea id="app-needs" value={needs} maxLength={500} onChange={(e) => setNeeds(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={busy === 'apply'} disabled={!prefs[0]?.hostelId && !acceptAny}>{app && status !== 'WITHDRAWN' ? 'Save changes' : 'Apply'}</Button>
              {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </form>
        )}

        {!data.applicationsOpen && !app && <p className="text-sm text-muted">Applications are closed. Contact the Hostel Office, or look at verified private hostels.</p>}
      </CardBody>
    </Card>
  );
}
