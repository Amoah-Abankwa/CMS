import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OfferingsService } from './offerings.service';
import {
  CourseOptionsDto, CreateDepartmentOfferingsDto, CreateOfferingDto, ListOfferingsDto, SetLecturersDto, UpdateOfferingDto,
} from './dto/offering.dto';

@Controller('offerings')
@RequirePermission(PERMISSIONS.OFFERINGS_MANAGE)
export class OfferingsController {
  constructor(private readonly offerings: OfferingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListOfferingsDto) {
    return this.offerings.list(user, q);
  }

  @Get('departments')
  departments(@CurrentUser() user: AuthUser) {
    return this.offerings.departments(user);
  }

  @Get('course-options')
  courseOptions(@CurrentUser() user: AuthUser, @Query() q: CourseOptionsDto) {
    return this.offerings.courseOptions(user, q.semesterId, q.departmentId);
  }

  @Get('lecturer-options')
  lecturerOptions(@Query() q: PaginationDto) {
    return this.offerings.lecturerOptions(q.search);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOfferingDto) {
    return this.offerings.create(user, dto);
  }

  @Post('department')
  createForDepartment(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentOfferingsDto) {
    return this.offerings.createForDepartment(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferingDto) {
    return this.offerings.updateCapacity(user, id, dto.capacity);
  }

  @Put(':id/lecturers')
  setLecturers(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetLecturersDto) {
    return this.offerings.setLecturers(user, id, dto.lecturers);
  }

  @Get(':id/roster')
  async roster(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const offering = await this.offerings.load(user, id);
    return { offering: offering.course, students: await this.offerings.roster(id) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.offerings.remove(user, id);
    return { ok: true };
  }
}
