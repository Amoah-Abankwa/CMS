import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, IsInt, Max, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SemesterQuery {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(16) mainStage?: number;
}

export class SaveRegistrationDto {
  @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) offeringIds: string[];
  /** The main semester (curriculum stage), for regular registration. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(16) mainStage?: number;
}


export class ListRegistrationsDto extends PaginationDto {
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']) status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

export class ApproveDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectDto {
  @IsString() @MinLength(5, { message: 'Tell the student what to change (at least 5 characters).' }) @MaxLength(500) note: string;
}
