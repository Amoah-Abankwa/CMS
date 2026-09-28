import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID,
  Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { STAFF_ASSIGNABLE_ROLES } from '@anu/shared';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RoleAssignmentDto {
  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: 'Choose a valid role.' }) roleKey: string;
  /** Department id for Head of Department, school id for Dean. */
  @IsOptional() @IsUUID() scopeId?: string;
}

export class RoleSetDto {
  @IsArray() @ArrayMinSize(1, { message: 'Give the staff member at least one role.' }) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => RoleAssignmentDto)
  roles: RoleAssignmentDto[];

  /** The role the person lands in when they sign in. Must be one of `roles`. */
  @IsIn(STAFF_ASSIGNABLE_ROLES) primaryRoleKey: string;
}

export class CreateStaffDto extends RoleSetDto {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(20) title?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @Transform(trim) @IsOptional()
  @Matches(/^(\+?233|0)?\d{9}$/, { message: 'Enter a valid Ghana phone number, for example 024 123 4567.' })
  phone?: string;

  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(/^[A-Z0-9/-]{2,30}$/, { message: 'Staff number can contain letters, digits, "/" and "-".' })
  staffNumber: string;

  @IsOptional() @IsUUID() departmentId?: string;
  @IsBoolean() isTeaching: boolean;
}

export class ListStaffDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(60) roleKey?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsIn(['PENDING_SETUP', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED']) status?: string;
}

export class AccountStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(5) @MaxLength(300) reason: string;
}
