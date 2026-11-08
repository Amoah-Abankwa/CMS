import * as ImagePicker from 'expo-image-picker';
import { axiosInstance } from './api';

/**
 * A public photo (a dish, a hostel), the same way the website sends one: the backend signs the upload
 * for the dish or hostel, the photo goes straight to Cloudinary, and its id comes back to save.
 * Returns null if the person cancels. Photos over 5 MB are refused before uploading.
 */
export async function pickAndUploadImage(purpose: 'menu' | 'hostel', targetId: string): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.fileSize && a.fileSize > 5 * 1024 * 1024) throw new Error('That photo is over 5 MB. Choose a smaller one.');
  const s = (await axiosInstance.post<{ cloudName: string; apiKey: string; timestamp: number; folder: string; allowedFormats: string; signature: string }>('/uploads/sign', { purpose, targetId })).data;
  const form = new FormData();
  form.append('file', { uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('folder', s.folder);
  form.append('allowed_formats', s.allowedFormats);
  form.append('signature', s.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form });
  const body = (await res.json()) as { public_id?: string; error?: { message: string } };
  if (!res.ok || !body.public_id) throw new Error(body.error?.message ?? 'The photo could not be uploaded. Try again.');
  return body.public_id;
}
