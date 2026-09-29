import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { loadEnv } from '../../core/config/env';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { resourceUrl, signParams } from './cloudinary';

type Kind = 'upload' | 'authenticated';

/**
 * Checks what was really uploaded (the browser's word is not trusted for size) and deletes files that
 * are no longer used. Deletions go through the job queue so a Cloudinary hiccup is retried.
 */
@Injectable()
export class CloudinaryAdminService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryAdminService.name);
  private readonly env = loadEnv();
  constructor(private readonly jobs: JobsService) {}

  async onModuleInit() {
    await this.jobs.work<{ publicId: string; type: Kind }>(QUEUES.CLOUDINARY_DESTROY, (j) => this.destroyNow(j.publicId, j.type));
  }

  private get creds() {
    const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = this.env;
    return cloud && key && secret ? { cloud, key, secret } : null;
  }

  /** The real size of an uploaded file; rejects (and deletes) it if over the limit or not found. */
  async assertSize(publicId: string, type: Kind, maxBytes: number) {
    const c = this.creds;
    if (!c) return;
    const res = await fetch(resourceUrl(c.cloud, type, publicId), { headers: { Authorization: `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString('base64')}` } });
    if (res.status === 404) throw new BadRequestException({ code: 'NOT_UPLOADED', message: 'The file did not finish uploading. Try again.' });
    if (!res.ok) { this.logger.warn(`Cloudinary size check failed (${res.status}) for ${publicId}`); return; }
    const body = (await res.json()) as { bytes?: number };
    if ((body.bytes ?? 0) > maxBytes) {
      await this.destroy(publicId, type);
      throw new BadRequestException({ code: 'TOO_BIG', message: `That file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` });
    }
  }

  /** Queues a file for deletion from Cloudinary. */
  async destroy(publicId: string | null | undefined, type: Kind = 'upload') {
    if (publicId && this.creds) await this.jobs.send(QUEUES.CLOUDINARY_DESTROY, { publicId, type });
  }

  private async destroyNow(publicId: string, type: Kind) {
    const c = this.creds;
    if (!c) return;
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, timestamp, type };
    const form = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.key, signature: signParams(params, c.secret) });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/destroy`, { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as { result?: string };
    // "not found" means it is already gone; anything else unexpected is retried by the queue.
    if (!res.ok || (body.result !== 'ok' && body.result !== 'not found')) throw new Error(`Cloudinary destroy ${publicId}: ${res.status} ${body.result ?? ''}`);
  }
}
