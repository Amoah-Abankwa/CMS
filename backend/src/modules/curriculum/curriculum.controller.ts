import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurriculumService } from './curriculum.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class CourseDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(12) code: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(150) title: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(12) creditHours: number;
  @IsUUID() departmentId: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class CourseQuery {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
class PrerequisitesDto { @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true }) prerequisiteIds: string[]; }
class PlaceDto {
  @IsUUID() courseId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(16) stage: number;
  @IsBoolean() isElective: boolean;
}

/** Courses and programme curricula: staff with the curriculum permission. */
@Controller('curriculum')
@RequirePermission(PERMISSIONS.CURRICULUM_MANAGE)
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}
  @Get('departments') departments() { return this.curriculum.departments(); }
  @Get('courses') courses(@Query() q: CourseQuery) { return this.curriculum.courses(q); }
  @Post('courses') create(@Body() dto: CourseDto) { return this.curriculum.saveCourse(dto); }
  @Patch('courses/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CourseDto) { return this.curriculum.saveCourse(dto, id); }
  @Delete('courses/:id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.curriculum.deleteCourse(id); }
  @Put('courses/:id/prerequisites') prerequisites(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PrerequisitesDto) { return this.curriculum.setPrerequisites(id, dto.prerequisiteIds); }
  @Get('programmes') programmes() { return this.curriculum.programmes(); }
  @Get('programmes/:id') programme(@Param('id', ParseUUIDPipe) id: string) { return this.curriculum.curriculum(id); }
  @Put('programmes/:id/courses') place(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlaceDto) { return this.curriculum.placeCourse(id, dto); }
  @Delete('programmes/:id/courses/:courseId') unplace(@Param('id', ParseUUIDPipe) id: string, @Param('courseId', ParseUUIDPipe) courseId: string) { return this.curriculum.removeCourse(id, courseId); }
}
