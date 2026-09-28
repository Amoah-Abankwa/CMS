import { Global, Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Global()
@Module({ controllers: [UploadsController, DocumentsController], providers: [UploadsService, DocumentsService], exports: [UploadsService, DocumentsService] })
export class UploadsModule {}
