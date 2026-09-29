import { api } from '@/lib/axios';

const MAX_BYTES = 10 * 1024 * 1024;
const EBOOK_MAX_BYTES = 50 * 1024 * 1024;
type Purpose = 'HOSTEL_FORM' | 'HOSTEL_FORM_SUBMISSION' | 'EXCUSE' | 'EBOOK';

/**
 * Uploads a private document straight to Cloudinary (as "authenticated", so it has no public address)
 * with a signature from our API, then records it. Returns the document id to attach.
 */
export async function uploadDocument(purpose: Purpose, file: File, targetId?: string): Promise<{ id: string; originalName: string }> {
  if (!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)) throw new Error('Upload a PDF, JPG or PNG.');
  if (file.size > (purpose === 'EBOOK' ? EBOOK_MAX_BYTES : MAX_BYTES)) throw new Error(purpose === 'EBOOK' ? 'E-books can be at most 50 MB.' : 'Documents can be at most 10 MB.');
  const s = (await api.post<{ cloudName: string; apiKey: string; timestamp: number; folder: string; allowedFormats: string; type: string; signature: string }>('/documents/sign', { purpose, targetId })).data;
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('folder', s.folder);
  form.append('allowed_formats', s.allowedFormats);
  form.append('type', s.type);
  form.append('signature', s.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as { public_id?: string; format?: string; bytes?: number; error?: { message?: string } };
  if (!res.ok || !body.public_id) throw new Error(body.error?.message ?? 'The document could not be uploaded. Try again.');
  return (await api.post<{ id: string; originalName: string }>('/documents', { purpose, targetId, publicId: body.public_id, format: body.format ?? 'pdf', bytes: body.bytes, originalName: file.name })).data;
}

/** Opens a document through the API, which checks access and redirects to a five-minute link. */
export const documentHref = (id: string) => `/api/v1/documents/${id}/download`;
