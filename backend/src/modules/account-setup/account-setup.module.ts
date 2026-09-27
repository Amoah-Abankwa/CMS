import { Global, Module } from '@nestjs/common';
import { AccountSetupService } from './account-setup.service';
import { AccountSetupController } from './account-setup.controller';

@Global()
@Module({ controllers: [AccountSetupController], providers: [AccountSetupService], exports: [AccountSetupService] })
export class AccountSetupModule {}
