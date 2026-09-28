import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadEnv } from '../../core/config/env';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { belongsTo, imageUrl, signParams } from './cloudinary';

const FORMATS = 'jpg,jpeg,png,webp';
const MAX_HOSTEL_PHOTOS = 8;

@Injectable()
export class UploadsService {
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly resolver: PermissionResolverService) {}

  private configured() {
    const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = this.env;
    if (!cloud || !key || !secret) throw new ServiceUnavailableException({ code: 'UPLOADS_OFF', message: 'Photo uploads are not set up yet. Ask ICT to add the Cloudinary settings.' });
    return { cloud, key, secret };
  }

  url(publicId: string | null | undefined, width?: number) {
    return publicId && this.env.CLOUDINARY_CLOUD_NAME ? imageUrl(this.env.CLOUDINARY_CLOUD_NAME, publicId, width) : null;
  }

  /** The folder a person may upload into for a purpose, after checking they own the thing. */
  private async folder(user: AuthUser, purpose: 'menu' | 'hostel', targetId: string) {
    if (purpose === 'menu') {
      const item = await this.prisma.menuItem.findUnique({ where: { id: targetId }, select: { vendor: { select: { id: true, ownerId: true } } } });
      if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dish not found.' });
      if (item.vendor.ownerId !== user.id) throw new ForbiddenException({ code: 'NOT_YOURS', message: 'This is not your dish.' });
      return `anu/menu/${item.vendor.id}`;
    }
    const hostel = await this.prisma.hostel.findUnique({ where: { id: targetId }, select: { id: true, ownerId: true } });
    if (!hostel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (hostel.ownerId !== user.id && !perms.has(PERMISSIONS.HOSTELS_MANAGE)) throw new ForbiddenException({ code: 'NOT_YOURS', message: 'This is not your hostel.' });
    return `anu/hostels/${hostel.id}`;
  }

  /** A short-lived signature for one browser upload straight to Cloudinary. */
  async sign(user: AuthUser, purpose: 'menu' | 'hostel', targetId: string) {
    const { cloud, key, secret } = this.configured();
    const folder = await this.folder(user, purpose, targetId);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { allowed_formats: FORMATS, folder, timestamp };
    return { cloudName: cloud, apiKey: key, timestamp, folder, allowedFormats: FORMATS, signature: signParams(params, secret) };
  }

  async setMenuPhoto(user: AuthUser, itemId: string, publicId: string | null) {
    const folder = await this.folder(user, 'menu', itemId);
    if (publicId && !belongsTo(publicId, folder)) throw new BadRequestException({ code: 'WRONG_FOLDER', message: 'That photo was not uploaded for this shop.' });
    await this.prisma.menuItem.update({ where: { id: itemId }, data: { photoId: publicId } });
    await this.audit.record({ action: 'uploads.menu_photo_set', module: 'marketplace', targetType: 'MenuItem', targetId: itemId, after: { photo: publicId ? 'set' : 'removed' } });
    return { photoUrl: this.url(publicId) };
  }

  async hostelPhotos(user: AuthUser, hostelId: string) {
    await this.folder(user, 'hostel', hostelId);
    const h = await this.prisma.hostel.findUniqueOrThrow({ where: { id: hostelId }, select: { photoIds: true } });
    return { photos: h.photoIds.map((id) => ({ publicId: id, url: this.url(id, 600) })), max: MAX_HOSTEL_PHOTOS, enabled: !!this.env.CLOUDINARY_CLOUD_NAME };
  }

  async setHostelPhotos(user: AuthUser, hostelId: string, publicIds: string[]) {
    const folder = await this.folder(user, 'hostel', hostelId);
    if (publicIds.length > MAX_HOSTEL_PHOTOS) throw new BadRequestException({ code: 'TOO_MANY', message: `At most ${MAX_HOSTEL_PHOTOS} photos.` });
    if (publicIds.some((p) => !belongsTo(p, folder))) throw new BadRequestException({ code: 'WRONG_FOLDER', message: 'A photo was not uploaded for this hostel.' });
    await this.prisma.hostel.update({ where: { id: hostelId }, data: { photoIds: publicIds } });
    await this.audit.record({ action: 'uploads.hostel_photos_set', module: 'accommodation', targetType: 'Hostel', targetId: hostelId, after: { photos: publicIds.length } });
    return { photoUrls: publicIds.map((p) => this.url(p)) };
  }
}
