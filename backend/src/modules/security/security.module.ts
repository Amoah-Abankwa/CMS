import { RetentionController } from './retention.controller';
import { Module } from '@nestjs/common';
import { ProductionGuardService } from './production-guard.service';
import { HousekeepingService } from './housekeeping.service';

@Module({ controllers: [RetentionController], providers: [ProductionGuardService, HousekeepingService] })
export class SecurityModule {}
