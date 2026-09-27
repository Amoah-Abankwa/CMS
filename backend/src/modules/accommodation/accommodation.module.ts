import { Module } from '@nestjs/common';
import { HostelsController, MyAccommodationController, OwnerController, ResidenceController } from './accommodation.controller';
import { HostelsService } from './hostels.service';
import { AllocationService } from './allocation.service';
import { StudentAccommodationService } from './student-accommodation.service';
import { OwnerService } from './owner.service';
import { ResidenceService } from './residence.service';

@Module({
  controllers: [HostelsController, MyAccommodationController, OwnerController, ResidenceController],
  providers: [HostelsService, AllocationService, StudentAccommodationService, OwnerService, ResidenceService],
})
export class AccommodationModule {}
