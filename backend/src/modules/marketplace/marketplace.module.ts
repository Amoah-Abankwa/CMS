import { Module } from '@nestjs/common';
import { FoodController, MarketplaceAdminController, VendorController } from './marketplace.controller';
import { MarketplaceSettingsService } from './marketplace-settings.service';
import { VendorsAdminService } from './vendors-admin.service';
import { VendorService } from './vendor.service';
import { CustomerService } from './customer.service';
import { OrdersService } from './orders.service';

@Module({
  controllers: [MarketplaceAdminController, VendorController, FoodController],
  providers: [MarketplaceSettingsService, VendorsAdminService, VendorService, CustomerService, OrdersService],
})
export class MarketplaceModule {}
