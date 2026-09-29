import { Global, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TransfersService } from './transfers.service';

@Global()
@Module({ controllers: [PaymentsController], providers: [PaymentsService, TransfersService], exports: [PaymentsService, TransfersService] })
export class PaymentsModule {}
