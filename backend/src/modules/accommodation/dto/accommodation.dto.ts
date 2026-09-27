import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DIGITAL = /^[A-Z]{2}-\d{3,4}-\d{4}$/;

export class SemesterQuery {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class HostelDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name: string;
  @IsIn(['MALE', 'FEMALE', 'MIXED']) gender: 'MALE' | 'FEMALE' | 'MIXED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) location?: string;
  @Transform(({ value }) => (value ? String(value).trim().toUpperCase() : undefined)) @IsOptional() @Matches(DIGITAL, { message: 'Enter a GhanaPost digital address such as EN-012-3456.' }) digitalAddress?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) distanceNote?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(15) @IsString({ each: true }) @MaxLength(40, { each: true }) facilities?: string[];
  @Transform(trim) @IsOptional() @Matches(/^(\+?233|0)?\d{9}$/, { message: 'Enter a valid Ghana phone number.' }) contactPhone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class BulkRoomsDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @Matches(/^[A-Z]{0,3}$/, { message: 'Prefix can be up to 3 letters.' }) prefix: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(9999) from: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(9999) to: number;
  @IsOptional() @IsString() @MaxLength(20) floor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) capacity: number;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) roomType: string;
  /** In pesewas. */
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) pricePerSemester: number;
}

export class RoomUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) capacity: number;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) roomType: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) pricePerSemester: number;
  @IsBoolean() isActive: boolean;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

export class VerifyDto {
  @IsIn(['APPROVED', 'REJECTED', 'SUSPENDED']) status: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  @ValidateIf((o) => o.status !== 'APPROVED') @IsString() @MinLength(5) @MaxLength(500) note?: string;
}

export class OwnerDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName: string;
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase()) @IsEmail() email: string;
  @Transform(trim) @Matches(/^(\+?233|0)?\d{9}$/, { message: 'Enter a valid Ghana phone number.' }) phone: string;
}

export class RoundDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsDateString() opensAt: string;
  @IsDateString() closesAt: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) acceptanceDays: number;
}

export class ApplicationsQuery extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['SUBMITTED', 'ALLOCATED', 'UNPLACED', 'WITHDRAWN', 'SPECIAL_NEEDS']) status?: string;
}

export class PreferenceDto {
  @IsUUID() hostelId: string;
  @IsOptional() @IsString() @MaxLength(40) roomType?: string | null;
}

export class ApplicationDto {
  @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => PreferenceDto) preferences: PreferenceDto[];
  @IsBoolean() acceptAny: boolean;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) specialNeeds?: string;
  /** Only used if the student's record has no gender yet. */
  @IsOptional() @IsIn(['Female', 'Male']) gender?: 'Female' | 'Male';
}

export class SpecialNeedsDto {
  @IsBoolean() approved: boolean;
}

export class ManualAllocationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(8) @MaxLength(20) indexNumber: string;
  @IsUUID() roomId: string;
}

export class CancelAllocationDto {
  @IsString() @MinLength(5) @MaxLength(300) reason: string;
}

export class MoveAllocationDto {
  @IsUUID() roomId: string;
}

export class RoomTypeDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(60) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) bedsPerRoom: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) pricePerSemester: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(2000) availableBeds: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class BookingRequestDto {
  @IsUUID() roomTypeId: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) message?: string;
}

export class BookingResponseDto {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class BookingsQuery {
  @IsOptional() @IsIn(['REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED']) status?: string;
}

export class ResidenceDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(200) address: string;
  @Transform(({ value }) => (value ? String(value).trim().toUpperCase() : undefined)) @IsOptional() @Matches(DIGITAL, { message: 'Enter a GhanaPost digital address such as EN-012-3456.' }) digitalAddress?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) landmark?: string;
}

export class ResidenceQuery extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['UNIVERSITY', 'PRIVATE', 'OFF_CAMPUS', 'UNKNOWN']) kind?: string;
}
