import { api } from '@/lib/axios';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads one image straight from the browser to Cloudinary, using a signature from our API that fixes
 * the folder and the allowed formats. Returns the Cloudinary public id to save.
 */
export async function uploadImage(
  purpose: 'menu' | 'hostel' | 'profile',
  targetId: string,
  file: File,
): Promise<string> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > MAX_BYTES) throw new Error('Photos can be at most 5 MB.');
  const s = (await api.post<{ cloudName: string; apiKey: string; timestamp: number; folder: string; allowedFormats: string; signature: string }>('/uploads/sign', { purpose, targetId })).data;
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('folder', s.folder);
  form.append('allowed_formats', s.allowedFormats);
  form.append('signature', s.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as { public_id?: string; error?: { message?: string } };
  if (!res.ok || !body.public_id) throw new Error(body.error?.message ?? 'The photo could not be uploaded. Try again.');
  return body.public_id;
}
