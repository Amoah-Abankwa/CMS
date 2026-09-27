import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SemesterQuery {
  @IsOptional() @IsUUID() semesterId?: string;
}

export class SaveRegistrationDto {
  @IsArray() @ArrayMaxSize(15) @IsUUID('all', { each: true }) offeringIds: string[];
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
