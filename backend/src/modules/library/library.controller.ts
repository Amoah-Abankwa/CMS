import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { LibraryPolicyService } from './library-policy.service';
import { CatalogueService } from './catalogue.service';
import { CirculationService } from './circulation.service';
import { FinesService } from './fines.service';
import { BorrowerService } from './borrower.service';
import {
  AddCopiesDto, BorrowerLookupQuery, CatalogueQuery, CopyUpdateDto, FinesQuery, IssueDto, LibraryPolicyDto, PayFineDto, ReserveDto, ReturnDto, TitleDto, WaiveFineDto,
} from './dto/library.dto';

@Controller('library')
export class LibraryController {
  constructor(
    private readonly policy: LibraryPolicyService,
    private readonly catalogue: CatalogueService,
    private readonly circulation: CirculationService,
    private readonly fines: FinesService,
  ) {}

  // Anyone signed in can read the rules and search the catalogue.
  @Get('policy')
  getPolicy() {
    return this.policy.get();
  }

  @Get('catalogue')
  search(@Query() q: CatalogueQuery) {
    return this.catalogue.search(q);
  }

  @Get('catalogue/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogue.detail(id);
  }

  // Librarian
  @Put('policy') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  setPolicy(@Body() dto: LibraryPolicyDto) {
    return this.policy.set(dto);
  }

  @Post('titles') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  addTitle(@Body() dto: TitleDto) {
    return this.catalogue.save(dto);
  }

  @Patch('titles/:id') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  updateTitle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TitleDto) {
    return this.catalogue.save(dto, id);
  }

  @Post('titles/:id/copies') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  addCopies(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCopiesDto) {
    return this.catalogue.addCopies(id, dto);
  }

  @Patch('copies/:id') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  updateCopy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CopyUpdateDto) {
    return this.catalogue.updateCopy(id, dto);
  }

  @Post('fines/:id/waive') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_MANAGE)
  waive(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WaiveFineDto) {
    return this.fines.waive(u, id, dto.reason, dto.amount);
  }

  // Circulation desk
  @Get('desk/borrowers') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  lookup(@Query() q: BorrowerLookupQuery) {
    return this.circulation.lookup(q.q);
  }

  @Get('desk/borrowers/:id') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  borrower(@Param('id', ParseUUIDPipe) id: string) {
    return this.circulation.summary(id);
  }

  @Post('desk/issue') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  issue(@CurrentUser() u: AuthUser, @Body() dto: IssueDto) {
    return this.circulation.issue(u, dto.borrowerId, dto.barcode);
  }

  @Post('desk/return') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  return(@CurrentUser() u: AuthUser, @Body() dto: ReturnDto) {
    return this.circulation.return(u, dto.barcode);
  }

  @Post('desk/loans/:id/renew') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  renew(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circulation.renew(id, { deskUser: u });
  }

  @Post('desk/loans/:id/lost') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  lost(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circulation.lost(u, id);
  }

  @Get('overdue') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  overdue() {
    return this.circulation.overdueList();
  }

  @Get('holds') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  holds() {
    return this.circulation.holdsShelf();
  }

  @Get('stats') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  stats() {
    return this.circulation.stats();
  }

  @Get('fines') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  listFines(@Query() q: FinesQuery) {
    return this.fines.list(q);
  }

  @Post('fines/:id/pay') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE)
  pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayFineDto) {
    return this.fines.pay(u, id, dto);
  }
}

@Controller('me/library')
export class MyLibraryController {
  constructor(private readonly borrower: BorrowerService) {}

  @Get()
  mine(@CurrentUser() u: AuthUser) {
    return this.borrower.mine(u);
  }

  @Post('loans/:id/renew') @HttpCode(200)
  renew(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.borrower.renew(u, id);
  }

  @Post('reservations')
  reserve(@CurrentUser() u: AuthUser, @Body() dto: ReserveDto) {
    return this.borrower.reserve(u, dto.titleId);
  }

  @Post('reservations/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.borrower.cancelReservation(u, id);
  }
}
