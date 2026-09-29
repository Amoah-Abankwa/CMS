import { Global, Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { CloudinaryAdminService } from './cloudinary-admin.service';

@Global()
@Module({ controllers: [UploadsController, DocumentsController], providers: [UploadsService, DocumentsService, CloudinaryAdminService], exports: [UploadsService, DocumentsService, CloudinaryAdminService] })
export class UploadsModule {}
