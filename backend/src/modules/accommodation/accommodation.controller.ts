import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HostelsService } from './hostels.service';
import { AllocationService } from './allocation.service';
import { StudentAccommodationService } from './student-accommodation.service';
import { OwnerService } from './owner.service';
import { ResidenceService } from './residence.service';
import {
  ApplicationDto, ApplicationsQuery, BookingRequestDto, BookingResponseDto, BookingsQuery, BulkRoomsDto, CancelAllocationDto, HostelDto, ManualAllocationDto,
  MoveAllocationDto, OwnerDto, ResidenceDto, ResidenceQuery, RoomTypeDto, RoomUpdateDto, RoundDto, SemesterQuery, SpecialNeedsDto, VerifyDto,
} from './dto/accommodation.dto';

/** Hostel Office. */
@Controller('hostels')
@RequirePermission(PERMISSIONS.HOSTELS_MANAGE)
export class HostelsController {
  constructor(
    private readonly hostels: HostelsService,
    private readonly allocation: AllocationService,
  ) {}

  @Get()
  university(@Query() q: SemesterQuery) {
    return this.hostels.university(q.semesterId);
  }

  @Post()
  create(@Body() dto: HostelDto) {
    return this.hostels.saveUniversity(dto);
  }

  @Get('private')
  privateHostels() {
    return this.hostels.privateHostels();
  }

  @Get('owners')
  owners() {
    return this.hostels.owners();
  }

  @Post('owners')
  createOwner(@Body() dto: OwnerDto) {
    return this.hostels.createOwner(dto);
  }

  @Get('round')
  round(@Query() q: SemesterQuery) {
    return this.allocation.round(q.semesterId);
  }

  @Put('round')
  saveRound(@Body() dto: RoundDto) {
    return this.allocation.saveRound(dto);
  }

  @Get('applications')
  applications(@Query() q: ApplicationsQuery) {
    return this.allocation.applications(q);
  }

  @Post('applications/:id/special-needs') @HttpCode(200)
  specialNeeds(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SpecialNeedsDto) {
    return this.allocation.setSpecialNeeds(id, dto.approved);
  }

  @Post('allocation/run') @HttpCode(200)
  run(@CurrentUser() u: AuthUser, @Body() dto: SemesterQuery) {
    return this.allocation.run(u, dto.semesterId);
  }

  @Get('allocations')
  allocations(@Query() q: SemesterQuery & { status?: string }) {
    return this.allocation.allocations(q.semesterId, q.status);
  }

  @Post('allocation/publish') @HttpCode(200)
  publish(@CurrentUser() u: AuthUser, @Body() dto: SemesterQuery) {
    return this.allocation.publish(u, dto.semesterId);
  }

  @Post('allocations')
  manual(@CurrentUser() u: AuthUser, @Body() dto: ManualAllocationDto) {
    return this.allocation.manual(u, dto.semesterId, dto.indexNumber, dto.roomId);
  }

  @Post('allocations/:id/move') @HttpCode(200)
  move(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveAllocationDto) {
    return this.allocation.move(u, id, dto.roomId);
  }

  @Post('allocations/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelAllocationDto) {
    return this.allocation.cancel(u, id, dto.reason);
  }

  @Post(':id/verify') @HttpCode(200)
  verify(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto) {
    return this.hostels.verify(u, id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HostelDto) {
    return this.hostels.saveUniversity(dto, id);
  }

  @Get(':id/rooms')
  rooms(@Param('id', ParseUUIDPipe) id: string, @Query() q: SemesterQuery) {
    return this.hostels.rooms(id, q.semesterId);
  }

  @Post(':id/rooms')
  addRooms(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkRoomsDto) {
    return this.hostels.addRooms(id, dto);
  }

  @Patch('rooms/:roomId')
  updateRoom(@Param('roomId', ParseUUIDPipe) roomId: string, @Body() dto: RoomUpdateDto) {
    return this.hostels.updateRoom(roomId, dto);
  }
}

@Controller('me/accommodation')
export class MyAccommodationController {
  constructor(private readonly student: StudentAccommodationService) {}

  @Get()
  overview(@CurrentUser() u: AuthUser) {
    return this.student.overview(u);
  }

  @Put('application')
  apply(@CurrentUser() u: AuthUser, @Body() dto: ApplicationDto) {
    return this.student.apply(u, dto);
  }

  @Post('application/withdraw') @HttpCode(200)
  withdraw(@CurrentUser() u: AuthUser) {
    return this.student.withdraw(u);
  }

  @Post('offer/accept') @HttpCode(200)
  accept(@CurrentUser() u: AuthUser) {
    return this.student.respond(u, true);
  }

  @Post('offer/decline') @HttpCode(200)
  decline(@CurrentUser() u: AuthUser) {
    return this.student.respond(u, false);
  }

  @Get('private')
  privateHostels(@CurrentUser() u: AuthUser) {
    return this.student.privateHostels(u);
  }

  @Post('bookings')
  book(@CurrentUser() u: AuthUser, @Body() dto: BookingRequestDto) {
    return this.student.requestBooking(u, dto);
  }

  @Post('bookings/:id/cancel') @HttpCode(200)
  cancelBooking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.student.cancelBooking(u, id);
  }

  @Put('residence')
  declare(@CurrentUser() u: AuthUser, @Body() dto: ResidenceDto) {
    return this.student.declare(u, dto);
  }
}

/** A private hostel owner's own hostels. */
@Controller('my-hostels')
@RequirePermission(PERMISSIONS.PRIVATE_HOSTEL_OWN)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Get()
  hostels(@CurrentUser() u: AuthUser) {
    return this.owner.hostels(u);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: HostelDto) {
    return this.owner.save(u, dto);
  }

  @Get('bookings')
  bookings(@CurrentUser() u: AuthUser, @Query() q: BookingsQuery) {
    return this.owner.bookings(u, q.status);
  }

  @Post('bookings/:id/accept') @HttpCode(200)
  acceptBooking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BookingResponseDto) {
    return this.owner.respond(u, id, true, dto.note);
  }

  @Post('bookings/:id/decline') @HttpCode(200)
  declineBooking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BookingResponseDto) {
    return this.owner.respond(u, id, false, dto.note);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HostelDto) {
    return this.owner.save(u, dto, id);
  }

  @Post(':id/room-types')
  addRoomType(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoomTypeDto) {
    return this.owner.saveRoomType(u, id, dto);
  }

  @Patch(':id/room-types/:roomTypeId')
  updateRoomType(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string, @Body() dto: RoomTypeDto) {
    return this.owner.saveRoomType(u, id, dto, roomTypeId);
  }
}

@Controller('accommodation/residence')
@RequirePermission(PERMISSIONS.ACCOMMODATION_READ)
export class ResidenceController {
  constructor(private readonly residence: ResidenceService) {}

  @Get()
  overview(@Query() q: ResidenceQuery) {
    return this.residence.overview(q);
  }
}
