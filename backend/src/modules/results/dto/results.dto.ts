import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

export class BandDto {
  @IsString() @MinLength(1) @MaxLength(3) letter: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) minScore: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(10) gradePoint: number;
  @IsBoolean() isPass: boolean;
  @IsOptional() @IsString() @MaxLength(40) remark?: string;
}

export class SaveScaleDto {
  @IsString() @MinLength(3) @MaxLength(80) name: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) passMark: number;
  @Type(() => Number) @IsNumber() @Min(1) @Max(10) maxGradePoint: number;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BandDto) bands: BandDto[];
}

export class ComponentDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsIn(['CONTINUOUS', 'EXAM']) kind: 'CONTINUOUS' | 'EXAM';
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(100) weight: number;
  @Type(() => Number) @IsNumber() @Min(1) @Max(1000) maxScore: number;
}

export class SaveSchemeDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ComponentDto) components: ComponentDto[];
}

export class MarkEntryDto {
  @IsUUID() assessmentId: string;
  @IsUUID() studentId: string;
  @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) score: number | null;
  @IsBoolean() absent: boolean;
}

export class SaveMarksDto {
  @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => MarkEntryDto) entries: MarkEntryDto[];
}

export class ListSheetsDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['SUBMITTED', 'HOD_APPROVED', 'DEAN_APPROVED', 'PUBLISHED', 'ACTION']) status?: string;
}

export class ReturnSheetDto {
  @IsString() @MinLength(5, { message: 'Tell the lecturer what to correct (at least 5 characters).' }) @MaxLength(500) note: string;
}
