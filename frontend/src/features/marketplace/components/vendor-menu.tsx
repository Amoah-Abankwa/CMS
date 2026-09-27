'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { formatCedis, orderTotals } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { foodApi, type VendorMenu as Menu } from '../api';
import { useCart } from '../cart.store';
import { todaysHours } from './vendor-list';

export function VendorMenu({ vendorId }: { vendorId: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const cart = useCart();
  const lines = cart.vendorId === vendorId ? cart.lines : [];

  useEffect(() => { foodApi.menu(vendorId).then(setMenu).catch((err) => setError(errorMessage(err))); }, [vendorId]);

  const groups = useMemo(() => {
    if (!menu) return [];
    const byCat = menu.categories.map((c) => ({ name: c.name, items: menu.items.filter((i) => i.categoryId === c.id) }));
    const loose = menu.items.filter((i) => !i.categoryId || !menu.categories.some((c) => c.id === i.categoryId));
    return [...byCat, ...(loose.length ? [{ name: 'More', items: loose }] : [])].filter((g) => g.items.length);
  }, [menu]);

  if (error && !menu) return <Alert tone="danger">{error}</Alert>;
  if (!menu) return <Spinner />;
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-0">
      <PageHeader title={menu.name} description={`${menu.location}. Today: ${todaysHours(menu)}. About ${menu.prepMinutes} minutes.`} />
      {!menu.openNow && <Alert tone="warning">{menu.name} is not taking orders right now. You can look at the menu.</Alert>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.name}>
              <h2 className="mb-2 text-sm font-semibold">{g.name}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {g.items.map((i) => {
                  const inCart = lines.find((l) => l.id === i.id)?.quantity ?? 0;
                  return (
                    <li key={i.id} className={cn('flex items-center justify-between gap-3 px-4 py-3', !i.isAvailable && 'opacity-60')}>
                      <span className="min-w-0 text-sm">
                        <span className="font-medium">{i.name}</span> <span className="tabular-nums text-muted">{formatCedis(i.price)}</span>
                        {i.description && <span className="block text-xs text-muted">{i.description}</span>}
                        {i.tags.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{i.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span>}
                      </span>
                      {!i.isAvailable ? <Badge>Sold out</Badge> : inCart ? (
                        <span className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" aria-label={`One less ${i.name}`} onClick={() => cart.change(i.id, -1)}><Minus className="size-4" aria-hidden /></Button>
                          <span className="w-5 text-center tabular-nums">{inCart}</span>
                          <Button variant="secondary" size="sm" aria-label={`One more ${i.name}`} onClick={() => cart.change(i.id, 1)}><Plus className="size-4" aria-hidden /></Button>
                        </span>
                      ) : (
                        <Button variant="secondary" size="sm" disabled={!menu.openNow} onClick={() => cart.add(vendorId, { id: i.id, name: i.name, price: i.price })}>Add</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <Card className="hidden lg:block lg:sticky lg:top-4">
          <CardHeader title="Your order" />
          <CardBody className="flex flex-col gap-3">
            {lines.length === 0 ? <p className="text-sm text-muted">Nothing added yet.</p> : (
              <>
                <ul className="flex flex-col gap-1 text-sm">{lines.map((l) => <li key={l.id} className="flex justify-between gap-2"><span>{l.quantity} x {l.name}</span><span className="tabular-nums">{formatCedis(l.price * l.quantity)}</span></li>)}</ul>
                <p className="flex justify-between border-t border-border pt-2 text-sm font-medium"><span>Subtotal</span><span className="tabular-nums">{formatCedis(subtotal)}</span></p>
                <Button onClick={() => setCheckout(true)} disabled={!menu.openNow}>Check out</Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3 lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <Button className="w-full" onClick={() => setCheckout(true)} disabled={!menu.openNow}>Check out: {count} items, {formatCedis(subtotal)}</Button>
        </div>
      )}
      <CheckoutDialog open={checkout} menu={menu} onClose={() => setCheckout(false)} />
    </div>
  );
}

function CheckoutDialog({ open, menu, onClose }: { open: boolean; menu: Menu; onClose: () => void }) {
  const router = useRouter();
  const cart = useCart();
  const [fulfilment, setFulfilment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [payment, setPayment] = useState<'ONLINE' | 'ON_PICKUP'>('ONLINE');
  const [address, setAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFulfilment(menu.offersPickup ? 'PICKUP' : 'DELIVERY');
    setPayment(menu.acceptsOnline ? 'ONLINE' : 'ON_PICKUP');
    setAddress(menu.defaultAddress ?? '');
    setError(null);
  }, [open, menu]);

  // Campus dispatchers never carry cash, so their deliveries are paid online.
  const dispatched = fulfilment === 'DELIVERY' && menu.useDispatchers;
  useEffect(() => { if (dispatched) setPayment('ONLINE'); }, [dispatched]);
  const totals = orderTotals(cart.lines, fulfilment, menu);
  const place = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await foodApi.place({
        vendorId: menu.id, lines: cart.lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })), fulfilment, paymentOption: payment,
        deliveryAddress: fulfilment === 'DELIVERY' ? address.trim() : undefined, deliveryNote: deliveryNote.trim() || undefined, note: note.trim() || undefined,
      });
      cart.clear();
      if (r.paymentUrl) window.location.href = r.paymentUrl;
      else router.push(`/food/orders/${r.orderId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const choice = (active: boolean) => cn('flex-1 rounded-md border px-3 py-2 text-left text-sm', active ? 'border-primary bg-primary-soft font-medium' : 'border-border');
  return (
    <Dialog open={open} onClose={onClose} title="Check out" description={menu.name}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <ul className="flex flex-col gap-1 text-sm">{cart.lines.map((l) => <li key={l.id} className="flex justify-between"><span>{l.quantity} x {l.name}</span><span className="tabular-nums">{formatCedis(l.price * l.quantity)}</span></li>)}</ul>

        {menu.offersPickup && menu.offersDelivery && (
          <fieldset className="flex gap-2">
            <legend className="mb-1 text-sm font-medium">How do you want it?</legend>
            <button type="button" className={choice(fulfilment === 'PICKUP')} aria-pressed={fulfilment === 'PICKUP'} onClick={() => setFulfilment('PICKUP')}>Pick it up<span className="block text-xs font-normal text-muted">{menu.location}</span></button>
            <button type="button" className={choice(fulfilment === 'DELIVERY')} aria-pressed={fulfilment === 'DELIVERY'} onClick={() => setFulfilment('DELIVERY')}>Deliver it<span className="block text-xs font-normal text-muted">{formatCedis(menu.deliveryFee)}</span></button>
          </fieldset>
        )}
        {fulfilment === 'DELIVERY' && (
          <>
            <Field label="Deliver to" htmlFor="co-addr" hint={menu.deliveryNote ?? undefined}><Input id="co-addr" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} placeholder="Hall and room number" /></Field>
            <Field label="Directions (optional)" htmlFor="co-dnote"><Input id="co-dnote" value={deliveryNote} maxLength={200} onChange={(e) => setDeliveryNote(e.target.value)} /></Field>
          </>
        )}
        {dispatched && <p className="text-sm text-muted">A campus dispatcher brings deliveries from {menu.name}, so you pay online now.</p>}
        {menu.acceptsOnline && menu.acceptsPayOnPickup && !dispatched && (
          <fieldset className="flex gap-2">
            <legend className="mb-1 text-sm font-medium">How will you pay?</legend>
            <button type="button" className={choice(payment === 'ONLINE')} aria-pressed={payment === 'ONLINE'} onClick={() => setPayment('ONLINE')}>Pay now<span className="block text-xs font-normal text-muted">Mobile money or card</span></button>
            <button type="button" className={choice(payment === 'ON_PICKUP')} aria-pressed={payment === 'ON_PICKUP'} onClick={() => setPayment('ON_PICKUP')}>{fulfilment === 'DELIVERY' ? 'Pay on delivery' : 'Pay at the counter'}<span className="block text-xs font-normal text-muted">Cash or mobile money</span></button>
          </fieldset>
        )}
        <Field label="Note for the vendor (optional)" htmlFor="co-note"><Textarea id="co-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="For example: no pepper" /></Field>

        <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatCedis(totals.subtotal)}</dd></div>
          {totals.deliveryFee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{formatCedis(totals.deliveryFee)}</dd></div>}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCedis(totals.total)}</dd></div>
        </dl>
        {totals.belowMinimum && <Alert tone="warning">The minimum order is {formatCedis(menu.minimumOrder)}.</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Back to menu</Button>
          <Button loading={busy} disabled={!cart.lines.length || totals.belowMinimum || (fulfilment === 'DELIVERY' && address.trim().length < 3)} onClick={place}>
            {payment === 'ONLINE' ? `Pay ${formatCedis(totals.total)}` : 'Place order'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
