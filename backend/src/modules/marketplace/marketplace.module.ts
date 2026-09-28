import { Module } from '@nestjs/common';
import { DispatchController, FoodController, MarketplaceAdminController, VendorController } from './marketplace.controller';
import { DispatchService } from './dispatch.service';
import { EmploymentModule } from '../employment/employment.module';
import { MarketplaceSettingsService } from './marketplace-settings.service';
import { VendorsAdminService } from './vendors-admin.service';
import { VendorService } from './vendor.service';
import { CustomerService } from './customer.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [EmploymentModule],
  controllers: [MarketplaceAdminController, VendorController, FoodController, DispatchController],
  providers: [MarketplaceSettingsService, VendorsAdminService, VendorService, CustomerService, OrdersService, DispatchService],
})
export class MarketplaceModule {}
