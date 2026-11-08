import { axiosInstance } from './api';

export interface PickedFile { uri: string; name: string; mimeType?: string | null; size?: number | null }

/**
 * A private document (a medical note, a signed form), the same way the website sends one: the backend
 * signs the upload, the file goes straight to Cloudinary as a private file, then the backend records it.
 * Returns the document's id to attach to the request.
 */
export async function uploadDocument(purpose: string, file: PickedFile, targetId?: string) {
  if (file.size && file.size > 10 * 1024 * 1024) throw new Error('TOO_BIG');
  const s = (await axiosInstance.post<{ cloudName: string; apiKey: string; timestamp: number; folder: string; allowedFormats: string; type: string; signature: string }>('/documents/sign', { purpose, targetId })).data;
  const form = new FormData();
  // React Native sends a file from its uri like this.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('folder', s.folder);
  form.append('allowed_formats', s.allowedFormats);
  form.append('type', s.type);
  form.append('signature', s.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = (await res.json()) as { public_id?: string; format?: string; bytes?: number; error?: { message: string } };
  if (!res.ok || !body.public_id) throw new Error(body.error?.message ?? 'UPLOAD_FAILED');
  return (await axiosInstance.post<{ id: string; originalName: string }>('/documents', { purpose, targetId, publicId: body.public_id, format: body.format ?? 'pdf', bytes: body.bytes, originalName: file.name })).data;
}
