import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PHONE = /^(\+?233|0)?\d{9}$/;

export class EmploymentRulesDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(4) minCgpa: number;
  @IsBoolean() allowNoResults: boolean;
  @Type(() => Number) @IsInt() @Min(1) @Max(3) maxJobs: number;
  @Type(() => Number) @IsInt() @Min(100) @Max(5000) dispatchFee: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) maxActiveDeliveries: number;
  @Type(() => Number) @IsInt() @Min(5) @Max(60) dispatchWaitMinutes: number;
}

export class JobDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) title: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) unit: string;
  @Transform(trim) @IsString() @MinLength(20) @MaxLength(3000) description: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) hoursPerWeek: number;
  @Type(() => Number) @IsInt() @Min(100) @Max(500_000) payRate: number;
  @IsIn(['HOUR', 'MONTH', 'TASK']) payUnit: 'HOUR' | 'MONTH' | 'TASK';
  @Type(() => Number) @IsInt() @Min(1) @Max(50) positions: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(4) minCgpa?: number | null;
  @IsDateString() closesAt: string;
  /** The staff member the student reports to. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value)) @IsOptional() @IsEmail() supervisorEmail?: string;
}

export class JobStatusDto {
  @IsIn(['DRAFT', 'OPEN', 'CLOSED']) status: 'DRAFT' | 'OPEN' | 'CLOSED';
}

export class DecisionDto {
  @IsIn(['SHORTLISTED', 'HIRED', 'REJECTED', 'ENDED']) status: 'SHORTLISTED' | 'HIRED' | 'REJECTED' | 'ENDED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsDateString() startDate?: string;
}

export class ApplyDto {
  @Transform(trim) @IsString() @MinLength(30, { message: 'Tell them a little more (at least 30 characters).' }) @MaxLength(1500) statement: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) availability?: string;
}

export class DispatcherApplyDto {
  @Transform(trim) @IsString() @MinLength(20, { message: 'Tell us a little more (at least 20 characters).' }) @MaxLength(1000) statement: string;
  @IsIn(['WALKING', 'BICYCLE', 'MOTORBIKE']) transport: 'WALKING' | 'BICYCLE' | 'MOTORBIKE';
  @IsIn(['MTN', 'Telecel', 'AirtelTigo']) payoutNetwork: string;
  @Transform(trim) @Matches(PHONE, { message: 'Enter a valid mobile money number.' }) payoutNumber: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) payoutName: string;
}

export class DispatcherReviewDto {
  @IsIn(['ACTIVE', 'REJECTED', 'SUSPENDED', 'ENDED']) status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ENDED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class DispatcherListQuery {
  @IsOptional() @IsIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'ENDED']) status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'ENDED';
}

export class IdParam {
  @IsUUID() id: string;
}
