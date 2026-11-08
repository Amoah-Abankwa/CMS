import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { axiosInstance } from './api';

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/**
 * Downloads a file the backend gives out (a PDF it makes, or a private document after its five-minute
 * signed redirect) with the person's own sign-in, saves it in the app's cache, and opens the share
 * sheet so it can be viewed, saved or sent.
 */
export async function openFile(path: string, filename: string) {
  const r = await axiosInstance.get<ArrayBuffer>(path, { responseType: 'arraybuffer' });
  const type = String(r.headers['content-type'] ?? 'application/pdf').split(';')[0];
  const base = filename.replace(/[^\w.-]/g, '-').replace(/\.(pdf|jpe?g|png)$/i, '');
  const file = new File(Paths.cache, `${base}.${EXT[type] ?? 'pdf'}`);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(r.data));
  await Sharing.shareAsync(file.uri, { mimeType: type, dialogTitle: filename });
}

/** PDFs the backend makes: slips, receipts, statements, payslips. */
export const openPdf = (path: string, filename: string) => openFile(path, filename);
