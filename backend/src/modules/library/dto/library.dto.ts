import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const list = ({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : value);

export class TitleDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(250) title: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(250) subtitle?: string;
  @Transform(list) @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(120, { each: true }) authors: string[];
  @Transform(({ value }) => (value ? String(value).replace(/[^0-9Xx]/g, '').toUpperCase() : undefined))
  @IsOptional() @Matches(/^(\d{9}[\dX]|\d{13})$/, { message: 'Enter a 10 or 13 digit ISBN.' }) isbn?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) publisher?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1400) @Max(2100) year?: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(40) edition?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) callNumber?: string;
  @Transform(list) @IsOptional() @IsArray() @ArrayMaxSize(15) @IsString({ each: true }) @MaxLength(60, { each: true }) subjects?: string[];
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class AddCopiesDto {
  /** Barcodes as printed on the labels, one per copy. */
  @Transform(list) @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @Matches(/^[A-Z0-9-]{3,30}$/i, { each: true, message: 'Barcodes can contain letters, digits and dashes.' }) barcodes: string[];
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) shelf?: string;
  @IsOptional() @IsBoolean() isReference?: boolean;
}

export class CopyUpdateDto {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) shelf?: string;
  @IsOptional() @IsBoolean() isReference?: boolean;
  /** Only these can be set by hand; loans and holds set the others. */
  @IsOptional() @IsIn(['AVAILABLE', 'DAMAGED', 'WITHDRAWN']) status?: 'AVAILABLE' | 'DAMAGED' | 'WITHDRAWN';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class CatalogueQuery extends PaginationDto {
  @IsOptional() @IsIn(['true', 'false']) availableOnly?: string;
}

export class BorrowerLookupQuery {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) q: string;
}

export class IssueDto {
  @IsUUID() borrowerId: string;
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(3) @MaxLength(30) barcode: string;
}

export class ReturnDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase()) @IsString() @MinLength(3) @MaxLength(30) barcode: string;
}

export class LoanRulesDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(180) loanDays: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) maxItems: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10) maxRenewals: number;
}

export class LibraryPolicyDto {
  @ValidateNested() @Type(() => LoanRulesDto) student: LoanRulesDto;
  @ValidateNested() @Type(() => LoanRulesDto) staff: LoanRulesDto;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000) finePerDay: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(30) graceDays: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) maxFinePerItem: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) blockAtFines: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) lostItemFee: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(14) holdDays: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(10) maxReservations: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(14) dueReminderDays: number;
  @IsArray() @ArrayMaxSize(6) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) closedDays: number[];
}

export class FinesQuery extends PaginationDto {
  @IsOptional() @IsIn(['OUTSTANDING', 'SETTLED', 'ALL']) status?: string;
}

export class PayFineDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) amount: number;
  @IsIn(['CASH', 'MOBILE_MONEY']) method: 'CASH' | 'MOBILE_MONEY';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(40) receiptNumber?: string;
}

export class WaiveFineDto {
  /** Omit to waive everything still owed. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) amount?: number;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) reason: string;
}

export class ReserveDto {
  @IsUUID() titleId: string;
}
