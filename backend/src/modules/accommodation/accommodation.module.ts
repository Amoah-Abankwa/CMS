import { HostelFormsController } from './hostel-forms.controller';
import { HostelFormsService } from './hostel-forms.service';
import { HostelFeesController, HostelOwnerPayoutsController } from './hostel-fees.controller';
import { HostelFeesService } from './hostel-fees.service';
import { FeesModule } from '../fees/fees.module';
import { Module } from '@nestjs/common';
import { HostelsController, MyAccommodationController, OwnerController, ResidenceController } from './accommodation.controller';
import { HostelsService } from './hostels.service';
import { AllocationService } from './allocation.service';
import { StudentAccommodationService } from './student-accommodation.service';
import { OwnerService } from './owner.service';
import { ResidenceService } from './residence.service';

@Module({
  imports: [FeesModule],
  controllers: [HostelFormsController, HostelFeesController, HostelOwnerPayoutsController, HostelsController, MyAccommodationController, OwnerController, ResidenceController],
  providers: [HostelFormsService, HostelFeesService, HostelsService, AllocationService, StudentAccommodationService, OwnerService, ResidenceService],
})
export class AccommodationModule {}
