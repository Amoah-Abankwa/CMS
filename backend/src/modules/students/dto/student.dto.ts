import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterStudentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @Transform(trim)
  @Matches(/^(\+?233|0)?\d{9}$/, { message: 'Enter a valid Ghana phone number, for example 024 123 4567.' })
  phone: string;

  @IsUUID() programmeId: string;

  @IsInt() @Min(2000) @Max(2099) admissionYear: number;

  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsIn(['Female', 'Male']) gender?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) nationality?: string;
}

export class ListStudentsDto extends PaginationDto {
  @IsOptional() @IsUUID() programmeId?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() admissionYear?: number;
}
