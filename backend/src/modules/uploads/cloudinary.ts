import { createHash } from 'node:crypto';

/**
 * Cloudinary signed uploads (https://cloudinary.com/documentation/signatures). The browser uploads
 * straight to Cloudinary with a signature the API creates, so the API secret never leaves the server
 * and every upload goes into the folder the signature names, with the formats it allows.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/** An image URL for a stored public id, resized and in a modern format. */
export function imageUrl(cloudName: string, publicId: string, width = 800) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_limit,w_${width},q_auto,f_auto/${publicId}`;
}

/** A public id is accepted only if it is inside the folder the upload was signed for. */
export function belongsTo(publicId: string, folder: string) {
  return publicId.startsWith(`${folder}/`) && !publicId.includes('..') && /^[\w/-]+$/.test(publicId);
}

/**
 * A time-limited download link for a private ("authenticated") file, as Cloudinary's SDKs build with
 * private_download_url: the parameters are signed like an upload, so the link cannot be altered and
 * stops working when expires_at passes.
 */
export function privateDownloadUrl(o: { cloudName: string; apiKey: string; apiSecret: string; publicId: string; format: string; expiresInSeconds?: number; now?: number }) {
  const timestamp = Math.floor((o.now ?? Date.now()) / 1000);
  const params: Record<string, string | number> = { attachment: 'true', expires_at: timestamp + (o.expiresInSeconds ?? 300), format: o.format, public_id: o.publicId, timestamp, type: 'authenticated' };
  const signature = signParams(params, o.apiSecret);
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: o.apiKey, signature });
  return `https://api.cloudinary.com/v1_1/${o.cloudName}/image/download?${query.toString()}`;
}
