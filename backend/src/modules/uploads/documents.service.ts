import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadEnv } from '../../core/config/env';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { belongsTo, privateDownloadUrl, signParams } from './cloudinary';

export type DocPurpose = 'HOSTEL_FORM' | 'HOSTEL_FORM_SUBMISSION' | 'EXCUSE';
const FORMATS = 'pdf,jpg,jpeg,png';
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Private documents (hostel forms, signed forms, excuse evidence) in Cloudinary. Files are uploaded as
 * "authenticated", so they have no public address; people get a five-minute download link only after
 * the API checks they may see the document.
 */
@Injectable()
export class DocumentsService {
  private readonly env = loadEnv();
  constructor(private readonly prisma: PrismaService, private readonly resolver: PermissionResolverService, private readonly audit: AuditService) {}

  private config() {
    const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = this.env;
    if (!cloud || !key || !secret) throw new ServiceUnavailableException({ code: 'UPLOADS_OFF', message: 'Document uploads are not set up yet. Ask ICT to add the Cloudinary settings.' });
    return { cloud, key, secret };
  }

  private async perms(user: AuthUser) {
    return this.resolver.permissionsFor(user.id, user.activeRoleKey);
  }

  /** The folder a person may upload into for a purpose, after checking they may. */
  private async folder(user: AuthUser, purpose: DocPurpose, targetId?: string) {
    if (purpose === 'EXCUSE') {
      if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Students upload their own excuse documents.' });
      return `anu/docs/excuses/${user.id}`;
    }
    if (purpose === 'HOSTEL_FORM') {
      // targetId: a hostel id, or "university" for every university hall.
      const perms = await this.perms(user);
      if (!targetId || targetId === 'university') {
        if (!perms.has(PERMISSIONS.HOSTELS_MANAGE)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'Only the Hostel Manager adds forms for university halls.' });
        return 'anu/docs/hostel-forms/university';
      }
      const h = await this.prisma.hostel.findUnique({ where: { id: targetId }, select: { kind: true, ownerId: true } });
      if (!h) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hostel not found.' });
      if (!(h.kind === 'PRIVATE' ? h.ownerId === user.id : perms.has(PERMISSIONS.HOSTELS_MANAGE))) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You do not run this hostel.' });
      return `anu/docs/hostel-forms/${targetId}`;
    }
    if (!targetId) throw new BadRequestException({ code: 'TARGET', message: 'Say which form this is for.' });
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Students upload their own signed forms.' });
    return `anu/docs/hostel-submissions/${targetId}/${user.id}`;
  }

  async sign(user: AuthUser, purpose: DocPurpose, targetId?: string) {
    const { cloud, key, secret } = this.config();
    const folder = await this.folder(user, purpose, targetId);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { allowed_formats: FORMATS, folder, timestamp, type: 'authenticated' };
    return { cloudName: cloud, apiKey: key, timestamp, folder, allowedFormats: FORMATS, type: 'authenticated', signature: signParams(params, secret) };
  }

  /** After the browser uploads, record the document; only files in the folder signed for this person are accepted. */
  async register(user: AuthUser, dto: { purpose: DocPurpose; targetId?: string; publicId: string; format: string; bytes?: number; originalName: string }) {
    const folder = await this.folder(user, dto.purpose, dto.targetId);
    if (!belongsTo(dto.publicId, folder)) throw new BadRequestException({ code: 'WRONG_FOLDER', message: 'That file was not uploaded for this.' });
    if (!FORMATS.split(',').includes(dto.format.toLowerCase())) throw new BadRequestException({ code: 'FORMAT', message: 'Upload a PDF, JPG or PNG.' });
    if (dto.bytes && dto.bytes > MAX_BYTES) throw new BadRequestException({ code: 'TOO_BIG', message: 'Documents can be at most 10 MB.' });
    const doc = await this.prisma.storedDocument.create({ data: { publicId: dto.publicId, format: dto.format.toLowerCase(), bytes: dto.bytes ?? null, originalName: dto.originalName.slice(0, 200), purpose: dto.purpose, uploadedById: user.id } });
    return { id: doc.id, originalName: doc.originalName };
  }

  /** Whether this person may open a document, from what it is attached to. */
  private async mayOpen(user: AuthUser, documentId: string) {
    const doc = await this.prisma.storedDocument.findUnique({
      where: { id: documentId },
      include: {
        formTemplates: { select: { id: true } },
        formSubmissions: { select: { studentId: true, template: { select: { hostel: { select: { kind: true, ownerId: true } } } } } },
        excuseRequests: { select: { studentId: true } },
      },
    });
    if (!doc) return null;
    if (doc.uploadedById === user.id) return doc;
    const perms = await this.perms(user);
    if (doc.purpose === 'HOSTEL_FORM' && doc.formTemplates.length) return doc; // blank forms are not private
    for (const s of doc.formSubmissions) {
      const h = s.template.hostel;
      if (s.studentId === user.id || (h ? (h.kind === 'PRIVATE' ? h.ownerId === user.id : perms.has(PERMISSIONS.HOSTELS_MANAGE)) : perms.has(PERMISSIONS.HOSTELS_MANAGE))) return doc;
    }
    for (const e of doc.excuseRequests) if (e.studentId === user.id || perms.has(PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE)) return doc;
    return null;
  }

  async downloadUrl(user: AuthUser, documentId: string) {
    const doc = await this.mayOpen(user, documentId);
    if (!doc) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Document not found.' });
    const { cloud, key, secret } = this.config();
    if (doc.purpose !== 'HOSTEL_FORM') await this.audit.record({ action: 'documents.opened', module: 'documents', targetType: 'StoredDocument', targetId: doc.id, metadata: { purpose: doc.purpose } });
    return privateDownloadUrl({ cloudName: cloud, apiKey: key, apiSecret: secret, publicId: doc.publicId, format: doc.format });
  }
}
