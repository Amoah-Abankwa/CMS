import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class SchoolDto {
  @Transform(upper) @Matches(/^[A-Z][A-Z0-9]{1,9}$/, { message: 'Use 2 to 10 capital letters or digits.' }) code: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) name: string;
}

export class DepartmentDto {
  @Transform(upper) @Matches(/^[A-Z][A-Z0-9]{1,9}$/, { message: 'Use 2 to 10 capital letters or digits.' }) code: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) name: string;
  @IsUUID() schoolId: string;
}

export class ProgrammeDto {
  @Transform(upper) @Matches(/^[A-Z][A-Z0-9-]{1,19}$/, { message: 'Use capital letters, digits and "-", e.g. BSC-CS.' }) code: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) name: string;
  @IsUUID() departmentId: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(3) levelCode: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) semesters?: number | null;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value)) @IsOptional() @Matches(/^[A-Z][A-Z0-9]{1,5}$/, { message: 'Use 2 to 6 capital letters or digits, starting with a letter, e.g. DCE.' }) indexCode?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProgrammeTypeDto {
  @Transform(upper) @Matches(/^[A-Z0-9]{1,3}$/, { message: 'Use 1 to 3 capital letters or digits.' }) code: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsIn(['DIPLOMA', 'BACHELORS', 'GRADUATE', 'OTHER']) category: 'DIPLOMA' | 'BACHELORS' | 'GRADUATE' | 'OTHER';
  @IsIn(['REGULAR', 'WEEKEND', 'SANDWICH', 'DISTANCE']) mode: 'REGULAR' | 'WEEKEND' | 'SANDWICH' | 'DISTANCE';
  @Type(() => Number) @IsInt() @Min(1) @Max(24) semesters: number;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(40) indexFormat: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ClearanceRuleDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) clearancePercent: number;
}

export class DevotionRuleDto {
  @IsBoolean() inTotals: boolean;
}
