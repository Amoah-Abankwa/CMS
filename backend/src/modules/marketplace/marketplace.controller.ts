import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { MarketplaceSettingsService } from './marketplace-settings.service';
import { VendorsAdminService } from './vendors-admin.service';
import { VendorService } from './vendor.service';
import { CustomerService } from './customer.service';
import { OrdersService } from './orders.service';
import { DispatchService } from './dispatch.service';
import {
  AvailabilityDto, MarkPaidDto, CategoryDto, CreateVendorDto, DeliveredDto, DispatcherPayoutDto, OnlineDto, ProblemDto, MarketplaceSettingsDto, MenuItemDto, OrdersQuery, PauseDto, PayoutDto, PlaceOrderDto, ReviewVendorDto, SettlementQuery, VendorActionDto, VendorProfileDto,
} from './dto/marketplace.dto';

@Controller('marketplace')
@RequirePermission(PERMISSIONS.MARKETPLACE_MANAGE)
export class MarketplaceAdminController {
  constructor(
    private readonly admin: VendorsAdminService,
    private readonly settings: MarketplaceSettingsService,
    private readonly dispatch: DispatchService,
  ) {}

  @Get('dispatcher-settlements')
  dispatcherSettlements(@Query() q: SettlementQuery) {
    return this.dispatch.settlements(q.from, q.to);
  }

  @Post('dispatcher-payouts')
  dispatcherPayout(@CurrentUser() u: AuthUser, @Body() dto: DispatcherPayoutDto) {
    return this.dispatch.recordPayout(u, dto);
  }

  @Get('vendors')
  vendors() {
    return this.admin.list();
  }

  @Post('vendors')
  create(@Body() dto: CreateVendorDto) {
    return this.admin.create(dto);
  }

  @Post('vendors/:id/review') @HttpCode(200)
  review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewVendorDto) {
    return this.admin.review(u, id, dto);
  }

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  setSettings(@Body() dto: MarketplaceSettingsDto) {
    return this.settings.set(dto);
  }

  @Get('settlements')
  settlements(@Query() q: SettlementQuery) {
    return this.admin.settlements(q.from, q.to);
  }

  @Post('payouts')
  payout(@CurrentUser() u: AuthUser, @Body() dto: PayoutDto) {
    return this.admin.recordPayout(u, dto);
  }
}

@Controller('vendor')
@RequirePermission(PERMISSIONS.VENDOR_OWN)
export class VendorController {
  constructor(private readonly vendor: VendorService) {}

  @Get()
  mine(@CurrentUser() u: AuthUser) {
    return this.vendor.mine(u);
  }

  @Put('profile')
  profile(@CurrentUser() u: AuthUser, @Body() dto: VendorProfileDto) {
    return this.vendor.updateProfile(u, dto);
  }

  @Post('pause') @HttpCode(200)
  pause(@CurrentUser() u: AuthUser, @Body() dto: PauseDto) {
    return this.vendor.setPaused(u, dto.paused);
  }

  @Post('categories')
  addCategory(@CurrentUser() u: AuthUser, @Body() dto: CategoryDto) {
    return this.vendor.saveCategory(u, dto);
  }

  @Patch('categories/:id')
  updateCategory(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto) {
    return this.vendor.saveCategory(u, dto, id);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendor.deleteCategory(u, id);
  }

  @Post('items')
  addItem(@CurrentUser() u: AuthUser, @Body() dto: MenuItemDto) {
    return this.vendor.saveItem(u, dto);
  }

  @Patch('items/:id')
  updateItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MenuItemDto) {
    return this.vendor.saveItem(u, dto, id);
  }

  @Post('items/:id/availability') @HttpCode(200)
  availability(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AvailabilityDto) {
    return this.vendor.setAvailable(u, id, dto.isAvailable);
  }

  @Delete('items/:id')
  deleteItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendor.deleteItem(u, id);
  }

  @Get('orders')
  board(@CurrentUser() u: AuthUser) {
    return this.vendor.board(u);
  }

  @Post('orders/:id/paid') @HttpCode(200)
  markPaid(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkPaidDto) {
    return this.vendor.markPaid(u, id, dto.via, dto.reference);
  }

  @Post('orders/:id/action') @HttpCode(200)
  act(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VendorActionDto) {
    return this.vendor.act(u, id, dto);
  }
}

@Controller('food')
export class FoodController {
  constructor(
    private readonly customer: CustomerService,
    private readonly orders: OrdersService,
  ) {}

  @Get('vendors')
  vendors(@CurrentUser() u: AuthUser) {
    return this.customer.vendors(u);
  }

  @Get('vendors/:id')
  menu(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customer.menu(u, id);
  }

  @Post('orders')
  place(@CurrentUser() u: AuthUser, @Body() dto: PlaceOrderDto) {
    return this.orders.place(u, dto);
  }

  @Get('orders')
  myOrders(@CurrentUser() u: AuthUser, @Query() q: OrdersQuery) {
    return this.customer.myOrders(u, q);
  }

  @Get('orders/:id')
  order(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customer.order(u, id);
  }

  @Post('orders/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customer.cancel(u, id);
  }

  @Post('orders/:id/pay') @HttpCode(200)
  pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.retryPayment(u, id);
  }
}

/** An approved student dispatcher's deliveries. */
@Controller('dispatch')
@RequirePermission(PERMISSIONS.DISPATCH_DELIVER)
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get()
  state(@CurrentUser() u: AuthUser) {
    return this.dispatch.state(u);
  }

  @Post('online') @HttpCode(200)
  online(@CurrentUser() u: AuthUser, @Body() dto: OnlineDto) {
    return this.dispatch.setOnline(u, dto.online);
  }

  @Post('deliveries/:id/take') @HttpCode(200)
  take(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.take(u, id);
  }

  @Post('deliveries/:id/release') @HttpCode(200)
  release(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.release(u, id);
  }

  @Post('deliveries/:id/picked-up') @HttpCode(200)
  pickedUp(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.dispatch.pickedUp(u, id);
  }

  @Post('deliveries/:id/delivered') @HttpCode(200)
  delivered(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DeliveredDto) {
    return this.dispatch.delivered(u, id, dto.code);
  }

  @Post('deliveries/:id/problem') @HttpCode(200)
  problem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProblemDto) {
    return this.dispatch.problem(u, id, dto.note);
  }

  @Get('earnings')
  earnings(@CurrentUser() u: AuthUser, @Query() q: SettlementQuery) {
    return this.dispatch.earnings(u, q.from, q.to);
  }
}
