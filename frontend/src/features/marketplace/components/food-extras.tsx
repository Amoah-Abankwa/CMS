'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { usePaymentReturn } from '@/features/fees/components/use-payment-return';
import { foodApi, type MealPlan, type MyMealPlan, type MyVendor } from '../api';

/** A customer's meal plans: meals left and when they expire. */
export function MyMealPlans() {
  const [plans, setPlans] = useState<MyMealPlan[] | null>(null);
  const load = useCallback(() => { foodApi.myPlans().then(setPlans).catch(() => setPlans([])); }, []);
  useEffect(() => { load(); }, [load]);
  const notice = usePaymentReturn(load);
  if (!plans) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {plans.length === 0 ? <EmptyState title="No meal plans" description="Vendors that sell meal plans show them on their menu page." /> : (
        <Card>
          <ul className="divide-y divide-border">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span><span className="font-medium">{p.plan.name}</span> <span className="text-muted">{p.plan.vendor.name}</span><span className="block text-xs text-muted">{p.expiresAt ? `Until ${formatDate(p.expiresAt)}. ` : ''}Choose it at checkout to use a meal.</span></span>
                {p.status === 'ACTIVE' ? <Badge tone="success">{p.mealsLeft} of {p.mealsTotal} meals left</Badge> : <Badge>{p.status === 'USED_UP' ? 'Used up' : 'Expired'}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** A vendor's ratings from customers. */
export function VendorRatings() {
  const [data, setData] = useState<Awaited<ReturnType<typeof foodApi.vendorRatings>> | null>(null);
  useEffect(() => { foodApi.vendorRatings().then(setData).catch(() => undefined); }, []);
  if (!data) return <Spinner />;
  return (
    <Card>
      <CardHeader title={data.average != null ? `${data.average.toFixed(1)} out of 5` : 'No ratings yet'} description={`${data.count} ratings from customers after their orders.`} />
      {data.rows.length === 0 ? <CardBody><EmptyState title="No ratings yet" /></CardBody> : (
        <ul className="divide-y divide-border">
          {data.rows.map((r, i) => <li key={i} className="px-4 py-2.5 text-sm sm:px-5"><span className="font-medium">{r.vendorStars} / 5</span> <span className="text-muted">order #{r.order.number}, {formatDate(r.createdAt)}</span>{r.vendorComment && <span className="block">{r.vendorComment}</span>}</li>)}
        </ul>
      )}
    </Card>
  );
}

/** A vendor's meal plans: a number of meals for a price, used one per order on the chosen dishes. */
export function VendorMealPlans() {
  const [plans, setPlans] = useState<Array<MealPlan & { _count: { purchases: number } }> | null>(null);
  const [menu, setMenu] = useState<MyVendor | null>(null);
  const [f, setF] = useState({ name: '', meals: '20', price: '', validDays: '30', items: [] as string[] });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { foodApi.ownPlans().then(setPlans).catch(() => setPlans([])); }, []);
  useEffect(() => { load(); foodApi.myVendor().then(setMenu).catch(() => undefined); }, [load]);
  if (!plans || !menu) return <Spinner />;
  const save = () => foodApi.savePlan({ name: f.name.trim(), meals: Number(f.meals), price: Math.round(Number(f.price) * 100), validDays: Number(f.validDays), eligibleItemIds: f.items })
    .then(() => { setMsg({ tone: 'success', text: 'Meal plan added. Customers see it on your menu.' }); setF({ ...f, name: '', price: '', items: [] }); load(); })
    .catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Add a meal plan" description="Customers pay online for a number of meals, then use one meal per order on the dishes you choose. Plan sales are in your settlement from the day they are paid; unused meals are not refunded when a plan expires." />
        <CardBody className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Name" htmlFor="mp-n"><Input id="mp-n" value={f.name} maxLength={80} placeholder="Lunch plan" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Meals" htmlFor="mp-m"><Input id="mp-m" type="number" min={2} value={f.meals} onChange={(e) => setF({ ...f, meals: e.target.value })} /></Field>
            <Field label="Price (GH₵)" htmlFor="mp-p"><Input id="mp-p" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field label="Valid for (days)" htmlFor="mp-d"><Input id="mp-d" type="number" min={1} value={f.validDays} onChange={(e) => setF({ ...f, validDays: e.target.value })} /></Field>
          </div>
          <fieldset><legend className="mb-1 text-sm font-medium">Dishes a meal covers</legend>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
              {menu.items.map((i) => <label key={i.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.items.includes(i.id)} onChange={(e) => setF({ ...f, items: e.target.checked ? [...f.items, i.id] : f.items.filter((x) => x !== i.id) })} /> {i.name} <span className="text-muted">{formatCedis(i.price)}</span></label>)}
            </div>
          </fieldset>
          <div><Button disabled={f.name.trim().length < 3 || !(Number(f.price) > 0) || !f.items.length} onClick={save}>Add plan</Button></div>
        </CardBody>
      </Card>
      {plans.length > 0 && (
        <Card>
          <CardHeader title="Your meal plans" />
          <ul className="divide-y divide-border">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span><span className="font-medium">{p.name}</span>: {p.meals} meals for {formatCedis(p.price)}, {p.validDays} days. <span className="text-muted">{p._count.purchases} sold.</span></span>
                <Button variant="ghost" size="sm" onClick={() => foodApi.savePlan({ name: p.name, meals: p.meals, price: p.price, validDays: p.validDays, eligibleItemIds: p.eligibleItemIds, isActive: !p.isActive }, p.id).then(load)}>{p.isActive ? 'Stop selling' : 'Sell again'}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Dean of Students office: hide abusive comments (the stars still count). */
export function RatingsModeration() {
  const [rows, setRows] = useState<Array<{ id: string; vendorStars: number; vendorComment: string; hiddenAt: string | null; createdAt: string; order: { number: number; vendor: { name: string } } }> | null>(null);
  const load = useCallback(() => { api.get('/marketplace/ratings').then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Spinner />;
  return (
    <Card>
      <CardHeader title="Customer comments" description="Hide a comment that is abusive or personal. The star rating still counts." />
      {rows.length === 0 ? <CardBody><EmptyState title="No comments yet" /></CardBody> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{r.order.vendor.name}</span> <span className="text-muted">{r.vendorStars} / 5, order #{r.order.number}, {formatDate(r.createdAt)}</span><span className={`block ${r.hiddenAt ? 'text-muted line-through' : ''}`}>{r.vendorComment}</span></span>
              <Button variant="ghost" size="sm" onClick={() => api.post(`/marketplace/ratings/${r.id}/hide`, { paused: !r.hiddenAt }).then(load)}>{r.hiddenAt ? 'Show' : 'Hide'}</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
