import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffRolesService } from './staff-roles.service';

@Module({ controllers: [StaffController], providers: [StaffService, StaffRolesService] })
export class StaffModule {}
