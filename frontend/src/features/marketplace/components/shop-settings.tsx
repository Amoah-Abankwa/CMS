'use client';

import { useEffect, useState } from 'react';
import { WEEKDAY_NAMES, type OpeningHours } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { foodApi, type MyVendor } from '../api';

/** Opening hours, how customers get their food and pay, and where Finance sends payouts. */
export function ShopSettings() {
  const [v, setV] = useState<MyVendor | null>(null);
  const [hours, setHours] = useState<OpeningHours>({});
  const [f, setF] = useState({ description: '', location: '', phone: '', acceptsOnline: true, acceptsPayOnPickup: true, offersPickup: true, offersDelivery: false, useDispatchers: false, deliveryFee: '0', deliveryNote: '', minimumOrder: '0', prepMinutes: '20', payoutNetwork: '', payoutNumber: '', payoutName: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    foodApi.myVendor().then((x) => {
      setV(x);
      setHours(x.openingHours);
      setF({
        description: x.description ?? '', location: x.location, phone: x.phone, acceptsOnline: x.acceptsOnline, acceptsPayOnPickup: x.acceptsPayOnPickup, offersPickup: x.offersPickup,
        offersDelivery: x.offersDelivery, useDispatchers: x.useDispatchers, deliveryFee: String(x.deliveryFee / 100), deliveryNote: x.deliveryNote ?? '', minimumOrder: String(x.minimumOrder / 100), prepMinutes: String(x.prepMinutes),
        payoutNetwork: x.payoutNetwork ?? '', payoutNumber: x.payoutNumber ?? '', payoutName: x.payoutName ?? '',
      });
    }).catch((err) => setError(errorMessage(err)));
  }, []);

  if (!v) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const set = (k: keyof typeof f, value: string | boolean) => { setF((x) => ({ ...x, [k]: value })); setSaved(false); };
  const day = (d: number) => hours[String(d)] ?? [];
  const setDay = (d: number, slots: Array<[string, string]>) => { setHours((h) => ({ ...h, [String(d)]: slots })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await foodApi.saveProfile({
        description: f.description.trim() || undefined, location: f.location.trim(), phone: f.phone.trim(), openingHours: hours,
        acceptsOnline: f.acceptsOnline, acceptsPayOnPickup: f.acceptsPayOnPickup, offersPickup: f.offersPickup, offersDelivery: f.offersDelivery, useDispatchers: f.offersDelivery && f.useDispatchers,
        deliveryFee: Math.round(Number(f.deliveryFee) * 100), deliveryNote: f.deliveryNote.trim() || undefined, minimumOrder: Math.round(Number(f.minimumOrder) * 100), prepMinutes: Number(f.prepMinutes),
        payoutNetwork: f.payoutNetwork || undefined, payoutNumber: f.payoutNumber.trim() || undefined, payoutName: f.payoutName.trim() || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const check = (k: 'acceptsOnline' | 'acceptsPayOnPickup' | 'offersPickup' | 'offersDelivery' | 'useDispatchers', label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
  );

  return (
    <div className="flex flex-col gap-4">
      {v.status !== 'APPROVED' && <Alert tone="warning">{v.status === 'PENDING' ? 'Waiting for the Dean of Students office to approve your shop. Set up your menu and hours meanwhile.' : `Your shop is ${v.status.toLowerCase()}.`}{v.statusNote ? ` ${v.statusNote}` : ''}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Settings saved.</Alert>}
      <Card>
        <CardHeader title={v.name} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Where customers find you" htmlFor="s-loc"><Input id="s-loc" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Phone" htmlFor="s-phone"><Input id="s-phone" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="About your shop (optional)" htmlFor="s-desc"><Textarea id="s-desc" value={f.description} maxLength={500} onChange={(e) => set('description', e.target.value)} /></Field></div>
          <Field label="Usual preparation time (minutes)" htmlFor="s-prep"><Input id="s-prep" type="number" inputMode="numeric" value={f.prepMinutes} onChange={(e) => set('prepMinutes', e.target.value)} /></Field>
          <Field label="Minimum order (GH₵)" htmlFor="s-min"><Input id="s-min" type="number" inputMode="decimal" value={f.minimumOrder} onChange={(e) => set('minimumOrder', e.target.value)} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Opening hours" description="Customers can only order in these hours. Leave a day empty when you are closed." />
        <CardBody>
          <ul className="flex flex-col gap-2">
            {WEEKDAY_NAMES.map((name, d) => (
              <li key={d} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="w-28 text-sm font-medium">{name}</span>
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  {day(d).length === 0 && <span className="text-sm text-muted">Closed</span>}
                  {day(d).map(([o, c], i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Input aria-label={`${name} opens`} type="time" className="w-28" value={o} onChange={(e) => setDay(d, day(d).map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} />
                      <span className="text-sm">to</span>
                      <Input aria-label={`${name} closes`} type="time" className="w-28" value={c} onChange={(e) => setDay(d, day(d).map((s, j) => (j === i ? [s[0], e.target.value] : s)))} />
                      <Button variant="ghost" size="sm" onClick={() => setDay(d, day(d).filter((_, j) => j !== i))}>Remove</Button>
                    </span>
                  ))}
                  {day(d).length < 3 && <Button variant="ghost" size="sm" onClick={() => setDay(d, [...day(d), ['08:00', '17:00']])}>Add hours</Button>}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pickup, delivery and payment" />
        <CardBody className="flex flex-col gap-3">
          {check('offersPickup', 'Customers can pick up')}
          {check('offersDelivery', 'We deliver')}
          {f.offersDelivery && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Delivery fee (GH₵)" htmlFor="s-fee"><Input id="s-fee" type="number" inputMode="decimal" value={f.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} /></Field>
              <Field label="Where you deliver (optional)" htmlFor="s-dnote"><Input id="s-dnote" value={f.deliveryNote} maxLength={200} onChange={(e) => set('deliveryNote', e.target.value)} placeholder="University halls only" /></Field>
            </div>
          )}
          {f.offersDelivery && (
            <div className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
              {check('useDispatchers', 'Use campus dispatchers for deliveries')}
              <p className="text-xs text-muted">Students approved by Career Services collect and deliver your orders. Each delivery costs the dispatcher fee, taken from your settlement. Delivered orders must be paid online, because dispatchers do not handle cash.</p>
            </div>
          )}
          {check('acceptsOnline', 'Customers can pay online (mobile money or card)')}
          {check('acceptsPayOnPickup', 'Customers can pay at the counter or on delivery')}
        </CardBody>
      </Card>

      {f.acceptsOnline && (
        <Card>
          <CardHeader title="Payouts" description="Online payments are collected by the university and paid to you by the Finance Office." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Network" htmlFor="s-net">
              <Select id="s-net" value={f.payoutNetwork} onChange={(e) => set('payoutNetwork', e.target.value)}>
                <option value="">Choose</option>
                <option value="MTN">MTN MoMo</option>
                <option value="Telecel">Telecel Cash</option>
                <option value="AirtelTigo">AirtelTigo Money</option>
              </Select>
            </Field>
            <Field label="Mobile money number" htmlFor="s-num"><Input id="s-num" type="tel" value={f.payoutNumber} onChange={(e) => set('payoutNumber', e.target.value)} /></Field>
            <Field label="Name on the account" htmlFor="s-name"><Input id="s-name" value={f.payoutName} maxLength={80} onChange={(e) => set('payoutName', e.target.value)} /></Field>
          </CardBody>
        </Card>
      )}
      <div><Button loading={busy} onClick={save}>Save settings</Button></div>
    </div>
  );
}
