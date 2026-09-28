'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { uploadImage } from '@/components/ui/image-upload';
import { cn } from '@/lib/cn';
import { foodApi, type MenuItem, type MyVendor } from '../api';

export function MenuEditor() {
  const [v, setV] = useState<MyVendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [category, setCategory] = useState('');

  const load = () => foodApi.myVendor().then(setV).catch((err) => setError(errorMessage(err)));
  useEffect(() => { void load(); }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!v) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const groups = [...v.categories.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: 'No category' }]
    .map((g) => ({ ...g, items: v.items.filter((i) => (g.id ? i.categoryId === g.id : !i.categoryId || !v.categories.some((c) => c.id === i.categoryId))) }))
    .filter((g) => g.id || g.items.length);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={(e) => { e.preventDefault(); if (category.trim().length >= 2) void run(async () => { await foodApi.saveCategory(category.trim()); setCategory(''); }); }} className="flex gap-2">
          <Input aria-label="New category" placeholder="New category, e.g. Drinks" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <Button size="sm" onClick={() => setEditing('new')}>Add a dish</Button>
      </div>
      {v.items.length === 0 && <EmptyState title="Your menu is empty" description="Add categories, then dishes with their prices." />}
      {groups.map((g) => (
        <Card key={g.id ?? 'none'}>
          <CardHeader title={g.name} actions={g.id ? <Button variant="ghost" size="sm" onClick={() => run(() => foodApi.deleteCategory(g.id!))}>Remove category</Button> : undefined} />
          {g.items.length === 0 ? <p className="px-4 py-3 text-sm text-muted sm:px-5">No dishes yet.</p> : (
            <ul className="divide-y divide-border">
              {g.items.map((i) => (
                <li key={i.id} className={cn('flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5', !i.isAvailable && 'opacity-70')}>
                  <span className="text-sm"><span className="font-medium">{i.name}</span> <span className="tabular-nums text-muted">{formatCedis(i.price)}</span>{i.description && <span className="block text-xs text-muted">{i.description}</span>}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="size-4" checked={i.isAvailable} onChange={(e) => run(() => foodApi.setAvailable(i.id, e.target.checked))} /> Available</label>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(i)}>Edit</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      <ItemDialog target={editing} categories={v.categories} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void load(); }} />
    </div>
  );
}

function ItemDialog({ target, categories, onClose, onDone }: { target: MenuItem | 'new' | null; categories: MyVendor['categories']; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', description: '', price: '', categoryId: '', tags: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const i = target && target !== 'new' ? target : null;
    setF({ name: i?.name ?? '', description: i?.description ?? '', price: i ? String(i.price / 100) : '', categoryId: i?.categoryId ?? categories[0]?.id ?? '', tags: i?.tags.join(', ') ?? '' });
    setError(null);
  }, [target, categories]);
  if (!target) return null;
  const existing = target !== 'new' ? target : null;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await foodApi.saveItem({ name: f.name.trim(), description: f.description.trim() || undefined, price: Math.round(Number(f.price) * 100), categoryId: f.categoryId || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) }, existing?.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await foodApi.deleteItem(existing.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add a dish'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Name" htmlFor="it-name"><Input id="it-name" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price (GH₵)" htmlFor="it-price"><Input id="it-price" type="number" inputMode="decimal" step="0.5" min={0.5} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Category" htmlFor="it-cat">
            <Select id="it-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description (optional)" htmlFor="it-desc"><Textarea id="it-desc" value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {existing ? <DishPhoto item={existing} onChanged={onDone} /> : <p className="text-xs text-muted">Save the dish first, then add a photo.</p>}
        <Field label="Labels (optional)" htmlFor="it-tags" hint="Separate with commas, for example: Spicy, Vegetarian."><Input id="it-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        <div className="flex flex-wrap justify-between gap-2">
          {existing ? <Button variant="ghost" onClick={remove} disabled={busy}>Remove dish</Button> : <span />}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={busy} disabled={f.name.trim().length < 2 || !(Number(f.price) >= 0.5)} onClick={save}>Save dish</Button>
          </span>
        </div>
      </div>
    </Dialog>
  );
}

function DishPhoto({ item, onChanged }: { item: MenuItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (file: File | null) => {
    setBusy(true);
    setError(null);
    try {
      const publicId = file ? await uploadImage('menu', item.id, file) : null;
      await api.put(`/uploads/menu-items/${item.id}/photo`, { publicId });
      onChanged();
    } catch (err) {
      setError(err instanceof Error && !('response' in err) ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Photo</span>
      {item.photoUrl && <img src={item.photoUrl} alt={item.name} className="h-32 w-48 rounded-md border border-border object-cover" />}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
          {busy ? 'Uploading…' : item.photoUrl ? 'Change photo' : 'Add a photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void set(f); e.target.value = ''; }} />
        </label>
        {item.photoUrl && <Button variant="ghost" size="sm" disabled={busy} onClick={() => set(null)}>Remove photo</Button>}
      </div>
    </div>
  );
}
