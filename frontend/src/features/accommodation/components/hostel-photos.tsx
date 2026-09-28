'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { uploadImage } from '@/components/ui/image-upload';
import { accommodationApi } from '../api';

type Photos = { photos: Array<{ publicId: string; url: string | null }>; max: number; enabled: boolean };

/** Photos of each of an owner's hostels. The first photo is the cover students see first. */
export function HostelPhotosPage() {
  const [hostels, setHostels] = useState<Array<{ id: string; name: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { accommodationApi.myHostels().then((h) => setHostels(h.map((x) => ({ id: x.id, name: x.name })))).catch((err) => setError(errorMessage(err))); }, []);
  if (!hostels) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!hostels.length) return <EmptyState title="No hostels yet" />;
  return <div className="flex flex-col gap-4">{hostels.map((h) => <HostelPhotos key={h.id} id={h.id} name={h.name} />)}</div>;
}

function HostelPhotos({ id, name }: { id: string; name: string }) {
  const [data, setData] = useState<Photos | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.get<Photos>(`/uploads/hostels/${id}/photos`).then((r) => setData(r.data)).catch((err) => setMsg(errorMessage(err))); }, [id]);
  useEffect(() => { load(); }, [load]);
  const save = async (ids: string[]) => {
    await api.put(`/uploads/hostels/${id}/photos`, { publicIds: ids });
    load();
  };
  const add = async (files: FileList) => {
    if (!data) return;
    setBusy(true);
    setMsg(null);
    try {
      const ids = data.photos.map((p) => p.publicId);
      for (const f of Array.from(files).slice(0, data.max - ids.length)) ids.push(await uploadImage('hostel', id, f));
      await save(ids);
    } catch (err) {
      setMsg(err instanceof Error && !('response' in err) ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (!data) return msg ? <Alert tone="danger">{msg}</Alert> : <Spinner />;
  const ids = data.photos.map((p) => p.publicId);
  return (
    <Card>
      <CardHeader title={name} description={`Up to ${data.max} photos. The first is the cover.`} />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone="danger">{msg}</Alert>}
        {!data.enabled && <Alert tone="info">Photo uploads are not set up yet.</Alert>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.photos.map((p, i) => (
            <li key={p.publicId} className="flex flex-col gap-1">
              {p.url && <img src={p.url} alt={`${name} photo ${i + 1}`} className="aspect-[4/3] w-full rounded-md border border-border object-cover" />}
              <span className="flex gap-1">
                {i > 0 && <Button variant="ghost" size="sm" onClick={() => save([p.publicId, ...ids.filter((x) => x !== p.publicId)])}>Make cover</Button>}
                <Button variant="ghost" size="sm" onClick={() => save(ids.filter((x) => x !== p.publicId))}>Remove</Button>
              </span>
            </li>
          ))}
        </ul>
        {data.enabled && ids.length < data.max && (
          <label className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
            {busy ? 'Uploading…' : 'Add photos'}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { if (e.target.files?.length) void add(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </CardBody>
    </Card>
  );
}
