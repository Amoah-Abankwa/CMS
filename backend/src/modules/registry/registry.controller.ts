import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RegistryService } from './registry.service';
import { DepartmentDto, DevotionRuleDto, ProgrammeDto, ProgrammeTypeDto, SchoolDto } from './registry.dto';

@Controller('registry')
@RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}
  @Get('structure') structure() { return this.registry.structure(); }
  @Get('devotion-rule') devotionRule() { return this.registry.devotionRule(); }
  @Put('devotion-rule') setDevotionRule(@Body() dto: DevotionRuleDto) { return this.registry.setDevotionRule(dto.inTotals); }
  @Post('schools') createSchool(@Body() dto: SchoolDto) { return this.registry.saveSchool(dto); }
  @Put('schools/:id') updateSchool(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SchoolDto) { return this.registry.saveSchool(dto, id); }
  @Post('departments') createDepartment(@Body() dto: DepartmentDto) { return this.registry.saveDepartment(dto); }
  @Put('departments/:id') updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentDto) { return this.registry.saveDepartment(dto, id); }
  @Delete('departments/:id') deleteDepartment(@Param('id', ParseUUIDPipe) id: string) { return this.registry.deleteDepartment(id); }
  @Post('programmes') createProgramme(@Body() dto: ProgrammeDto) { return this.registry.saveProgramme(dto); }
  @Put('programmes/:id') updateProgramme(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProgrammeDto) { return this.registry.saveProgramme(dto, id); }
  @Delete('programmes/:id') deleteProgramme(@Param('id', ParseUUIDPipe) id: string) { return this.registry.deleteProgramme(id); }
  @Post('programme-types') createType(@Body() dto: ProgrammeTypeDto) { return this.registry.saveType(dto); }
  @Put('programme-types/:code') updateType(@Param('code') code: string, @Body() dto: ProgrammeTypeDto) { return this.registry.saveType(dto, code); }
}
