import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { StudentRegistrationService } from './student-registration.service';
import { RegistrationReviewService } from './registration-review.service';
import { ApproveDto, ListRegistrationsDto, RejectDto, SaveRegistrationDto, SemesterQuery } from './dto/registration.dto';

/** The signed-in student's own registration. */
@Controller('me/registration')
export class MyRegistrationController {
  constructor(private readonly service: StudentRegistrationService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query() q: SemesterQuery) {
    return this.service.overview(user, q.semesterId);
  }

  @Put()
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveRegistrationDto) {
    return this.service.save(user, dto.offeringIds);
  }

  @Post('submit') @HttpCode(200)
  submit(@CurrentUser() user: AuthUser) {
    return this.service.submit(user);
  }

  @Post('withdraw') @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser) {
    return this.service.withdraw(user);
  }
}

@Controller('registrations')
@RequirePermission(PERMISSIONS.REGISTRATIONS_REVIEW)
export class RegistrationReviewController {
  constructor(private readonly review: RegistrationReviewService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListRegistrationsDto) {
    return this.review.list(user, q);
  }

  @Post(':id/approve') @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveDto) {
    return this.review.approve(user, id, dto.note);
  }

  @Post(':id/reject') @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.review.reject(user, id, dto.note);
  }
}
