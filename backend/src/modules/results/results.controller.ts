import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { PERMISSIONS } from '@anu/shared';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';

import { GradingService } from './grading.service';
import { MarksService } from './marks.service';
import { ResultApprovalsService } from './result-approvals.service';
import { StudentResultsService } from './student-results.service';

import {
  ListSheetsDto,
  ReturnSheetDto,
  SaveMarksDto,
  SaveSchemeDto,
  SaveScaleDto,
} from './dto/results.dto';

import { SemesterQuery } from '../registrations/dto/registration.dto';

@Controller('grading')
export class GradingController {
  constructor(private readonly grading: GradingService) {}

  /** Anyone signed in may read the scale; students see it on their results page. */
  @Get('scale')
  active() {
    return this.grading.active();
  }

  @Put('scale')
  @RequirePermission(PERMISSIONS.GRADING_MANAGE)
  save(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveScaleDto,
  ) {
    return this.grading.save(user, dto);
  }
}

/** Marks for courses the lecturer is assigned to. Access is checked per course in MarksService. */
@Controller('teaching/classes/:id')
@RequirePermission(PERMISSIONS.TEACHING_READ)
export class MarksController {
  constructor(private readonly marks: MarksService) {}

  @Get('marks')
  workbook(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.marks.workbook(user, id);
  }

  @Put('scheme')
  saveScheme(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveSchemeDto,
  ) {
    return this.marks.saveScheme(user, id, dto.components);
  }

  @Put('marks')
  saveMarks(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveMarksDto,
  ) {
    return this.marks.saveMarks(user, id, dto.entries);
  }

  @Post('assessments/:assessmentId/share')
  @HttpCode(200)
  share(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.marks.release(user, id, assessmentId);
  }

  @Post('results/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.marks.submit(user, id);
  }
}

/** Approval and publishing. The service checks which stage the person may act on. */
@Controller('results/sheets')
export class ResultSheetsController {
  constructor(
    private readonly approvals: ResultApprovalsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() q: ListSheetsDto,
  ) {
    return this.approvals.list(user, q);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvals.get(user, id);
  }

  @Post(':id/advance')
  @HttpCode(200)
  advance(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvals.advance(user, id);
  }

  @Post(':id/return')
  @HttpCode(200)
  returnSheet(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnSheetDto,
  ) {
    return this.approvals.return(user, id, dto.note);
  }
}

@Controller('me')
export class MyResultsController {
  constructor(
    private readonly studentResults: StudentResultsService,
  ) {}

  @Get('results')
  results(@CurrentUser() user: AuthUser) {
    return this.studentResults.results(user);
  }

  @Get('internals')
  internals(
    @CurrentUser() user: AuthUser,
    @Query() q: SemesterQuery,
  ) {
    return this.studentResults.internals(user, q.semesterId);
  }
}