import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditQueryService } from './audit-query.service';
import { AuditController } from './audit.controller';

@Global()
@Module({ controllers: [AuditController], providers: [AuditService, AuditQueryService], exports: [AuditService] })
export class AuditModule {}
