import { Module } from '@nestjs/common';
import { AssociationsAdminController, ClearanceRuleController, FeesAdminController, MyDuesController, MyFeesController, OfficerController } from './fees.controller';
import { FeeRulesService } from './fee-rules.service';
import { FeesService } from './fees.service';
import { DuesService } from './dues.service';
import { HallChargesService } from './hall-charges.service';

@Module({
  controllers: [FeesAdminController, ClearanceRuleController, MyFeesController, AssociationsAdminController, OfficerController, MyDuesController],
  providers: [FeeRulesService, FeesService, DuesService, HallChargesService],
  exports: [HallChargesService],
})
export class FeesModule {}
