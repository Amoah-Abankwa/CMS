import { DevotionExemptionsController, DevotionExemptionsService } from './devotion-exemptions.controller';
import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { DevotionController, MyDevotionController } from './devotion.controller';
import { DevotionPolicyService } from './devotion-policy.service';
import { DevotionServicesService } from './devotion-services.service';
import { DevotionScoresService } from './devotion-scores.service';

@Module({
  imports: [AttendanceModule],
  controllers: [DevotionExemptionsController, DevotionController, MyDevotionController],
  providers: [DevotionExemptionsService, DevotionPolicyService, DevotionServicesService, DevotionScoresService],
})
export class DevotionModule {}
