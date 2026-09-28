import { Module } from '@nestjs/common';
import { ProductionGuardService } from './production-guard.service';
import { HousekeepingService } from './housekeeping.service';

@Module({ providers: [ProductionGuardService, HousekeepingService] })
export class SecurityModule {}
