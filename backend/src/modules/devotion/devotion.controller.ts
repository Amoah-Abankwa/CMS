import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DevotionPolicyService } from './devotion-policy.service';
import { DevotionServicesService } from './devotion-services.service';
import { DevotionScoresService } from './devotion-scores.service';
import {
  AddServiceDto, CancelServiceDto, CorrectionDto, DevotionCheckInDto, DevotionPolicyDto, DoorEntryDto, RecordsQuery, ScoresQuery, SemesterQuery, UpdateServiceDto,
} from './dto/devotion.dto';

@Controller('devotion')
export class DevotionController {
  constructor(
    private readonly policy: DevotionPolicyService,
    private readonly services: DevotionServicesService,
    private readonly scores: DevotionScoresService,
  ) {}

  /** Everyone can read the rules; students see them on their page. */
  @Get('policy')
  getPolicy() {
    return this.policy.get();
  }

  @Put('policy') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  setPolicy(@Body() dto: DevotionPolicyDto) {
    return this.policy.set(dto);
  }

  @Get('services') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  list(@Query() q: SemesterQuery) {
    return this.services.list(q.semesterId);
  }

  @Post('services/generate') @HttpCode(200) @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  generate(@CurrentUser() u: AuthUser, @Body() dto: SemesterQuery) {
    return this.services.generate(u, dto.semesterId);
  }

  @Post('services') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  add(@CurrentUser() u: AuthUser, @Body() dto: AddServiceDto) {
    return this.services.add(u, dto);
  }

  @Patch('services/:id') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto.theme, dto.speaker);
  }

  @Post('services/:id/cancel') @HttpCode(200) @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelServiceDto) {
    await this.services.cancel(id, dto.reason);
    return { ok: true };
  }

  @Get('services/:id/screen') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  screen(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.screen(id);
  }

  @Post('services/:id/door') @HttpCode(200) @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  door(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DoorEntryDto) {
    return this.services.door(u, id, dto.indexNumber);
  }

  @Get('services/:id/records') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  records(@Param('id', ParseUUIDPipe) id: string, @Query() q: RecordsQuery) {
    return this.services.records(id, q);
  }

  @Put('services/:id/records/:studentId') @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  correct(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: CorrectionDto) {
    return this.services.correct(u, id, studentId, dto.status, dto.reason);
  }

  @Post('services/:id/close') @HttpCode(200) @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  close(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.services.close(u, id);
  }

  @Get('scores') @RequirePermission(PERMISSIONS.DEVOTION_READ)
  scoresList(@Query() q: ScoresQuery) {
    return this.scores.list(q);
  }

  @Post('scores/finalise') @HttpCode(200) @RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
  finalise(@CurrentUser() u: AuthUser, @Body() dto: SemesterQuery) {
    return this.scores.finalise(u, dto.semesterId);
  }
}

@Controller('me/devotion')
export class MyDevotionController {
  constructor(
    private readonly services: DevotionServicesService,
    private readonly scores: DevotionScoresService,
  ) {}

  @Get()
  mine(@CurrentUser() u: AuthUser) {
    return this.scores.mine(u);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('check-in') @HttpCode(200)
  checkIn(@CurrentUser() u: AuthUser, @Body() dto: DevotionCheckInDto) {
    return this.services.checkIn(u, dto.code);
  }
}
