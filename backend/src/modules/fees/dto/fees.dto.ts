import { Transform, Type } from 'class-transformer';

import {
  IsEmail,
  IsNumber,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const PHONE = /^(\+?233|0)?\d{9}$/;

export class FeeRulesDto {
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(500_000)
  minOnlinePayment: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100_000)
  minOnlinePaymentUsd: number;

  /** Late payment charges are off unless the Finance Office turns them on. */
  @IsOptional()
  @IsBoolean()
  lateFeeEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lateFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  lateFeeUsd?: number;
}

export class InstalmentPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => InstalmentDto)
  instalments: InstalmentDto[];
}

export class InstalmentDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  cumulativePercent: number;
}

export class StatementRowDto {
  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  reference: string;

  @Transform(trim)
  @IsString()
  @MaxLength(300)
  narration: string;
}

export class StatementDto {
  @IsIn(['GHS', 'USD'])
  currency: 'GHS' | 'USD';

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => StatementRowDto)
  rows: StatementRowDto[];
}

export class StatementApplyDto {
  @IsIn(['GHS', 'USD'])
  currency: 'GHS' | 'USD';

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => StatementMatchDto)
  items: StatementMatchDto[];
}

export class StatementMatchDto {
  @IsUUID()
  billId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  reference: string;

  @IsDateString()
  paidOn: string;
}

export class ClearanceRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  clearancePercent: number;
}

export class FeeItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ScheduleLineDto {
  @IsUUID()
  feeItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  amount: number;
}

export class ScheduleDto {
  @IsUUID()
  semesterId: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsUUID()
  programmeId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(900)
  level?: number | null;

  @IsIn(['ALL', 'GHANAIAN', 'INTERNATIONAL'])
  studentGroup: 'ALL' | 'GHANAIAN' | 'INTERNATIONAL';

  @IsIn(['GHS', 'USD'])
  currency: 'GHS' | 'USD';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ScheduleLineDto)
  lines: ScheduleLineDto[];
}

export class CopySchedulesDto {
  @IsUUID()
  fromSemesterId: string;

  @IsUUID()
  toSemesterId: string;
}

export class SemesterBody {
  @IsUUID()
  semesterId: string;
}

export class BillsQuery extends PaginationDto {
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  declare search?: string;

  @IsOptional()
  @IsIn(['UNPAID', 'PART', 'CLEARED', 'PAID'])
  status?: 'UNPAID' | 'PART' | 'CLEARED' | 'PAID';
}

export class RecordFeePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @IsIn(['BANK', 'MOBILE_MONEY', 'CHEQUE'])
  method: 'BANK' | 'MOBILE_MONEY' | 'CHEQUE';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  reference: string;

  @IsDateString()
  paidOn: string;

  /** When paid in the other currency (e.g. cedis towards a dollar bill); converted at the current rate. */
  @IsOptional()
  @IsIn(['GHS', 'USD'])
  paidCurrency?: 'GHS' | 'USD';
}

export class ExchangeRateDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  cedisPerDollar: number;

  @IsDateString()
  effectiveFrom: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class AdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(-100_000_000)
  @Max(100_000_000)
  @NotEquals(0)
  amount: number;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}

export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}

export class PayFeesDto {
  @IsUUID()
  billId: string;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100_000_000)
  amount: number;
}

export class DuesPayoutDto {
  @IsUUID()
  associationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

// ----- Associations and dues -----

export class AssociationDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/, {
    message:
      'Use 2 to 10 capital letters or digits, e.g. EHASSA.',
  })
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  departmentIds: string[];

  @IsOptional()
  @IsIn(['MTN', 'Telecel', 'AirtelTigo'])
  payoutNetwork?: string;

  @Transform(trim)
  @IsOptional()
  @Matches(PHONE, {
    message: 'Enter a valid mobile money number.',
  })
  payoutNumber?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  payoutName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OfficerDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  indexNumber: string;

  @IsIn(['PRESIDENT', 'TREASURER'])
  office: 'PRESIDENT' | 'TREASURER';

  @IsDateString()
  startsOn: string;

  @IsDateString()
  endsOn: string;
}

export class LevyDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amount: number;

  @IsDateString()
  dueOn: string;
}

export class LevyOpenDto {
  @IsBoolean()
  isOpen: boolean;
}

export class CashDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  indexNumber: string;
}

export class PatronDto {
  /** The patron's staff email; empty clears it. */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string | null;
}