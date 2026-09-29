'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, errorMessage } from '@/lib/axios';
import { uploadImage } from '@/components/ui/image-upload';
import { useAuthStore } from '@/stores/auth.store';

/** Upload, change or remove your profile photo (JPG, PNG or WebP, up to 5 MB). */
export function ProfilePhoto() {
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;
  const save = async (file: File | null) => {
    setBusy(true);
    setError(null);
    try {
      const publicId = file ? await uploadImage('profile', '', file) : null;
      const r = await api.put<{ photoUrl: string | null }>('/uploads/profile-photo', { publicId });
      setMe({ ...me, photoUrl: r.data.photoUrl });
    } catch (err) {
      setError(err instanceof Error && !('response' in err) ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex items-center gap-4">
        {me.photoUrl ? <img src={me.photoUrl} alt="Your profile photo" className="size-20 rounded-full border border-border object-cover" /> : <span className="grid size-20 place-items-center rounded-full bg-surface-muted text-lg font-semibold">{`${me.firstName[0] ?? ''}${me.lastName[0] ?? ''}`.toUpperCase()}</span>}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
            {busy ? 'Uploading…' : me.photoUrl ? 'Change photo' : 'Add a photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void save(f); e.target.value = ''; }} />
          </label>
          {me.photoUrl && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(null)}>Remove</Button>}
        </div>
      </div>
    </div>
  );
}
