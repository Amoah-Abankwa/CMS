import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

export class ListOfferingsDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(60) search?: string;
}

export class CreateOfferingDto {
  @IsUUID() semesterId: string;
  @IsUUID() courseId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) capacity?: number;
}

export class CreateDepartmentOfferingsDto {
  @IsUUID() semesterId: string;
  @IsUUID() departmentId: string;
}

export class UpdateOfferingDto {
  /** Null removes the seat limit. */
  @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(1) @Max(2000) capacity: number | null;
}

export class LecturerAssignmentDto {
  @IsUUID() userId: string;
  @IsBoolean() isLead: boolean;
}

export class SetLecturersDto {
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => LecturerAssignmentDto)
  lecturers: LecturerAssignmentDto[];
}

export class CourseOptionsDto {
  @IsUUID() semesterId: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
