import { Transform, Type } from 'class-transformer';
import {
  IsNumber, ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PHONE = /^(\+?233|0)?\d{9}$/;

export class CreateVendorDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName: string;
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase()) @IsEmail() email: string;
  @Transform(trim) @Matches(PHONE, { message: 'Enter a valid Ghana phone number.' }) phone: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) vendorName: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) location: string;
}

export class ReviewVendorDto {
  @IsIn(['APPROVED', 'SUSPENDED', 'REJECTED']) status: 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class MarketplaceSettingsDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(30) commissionPercent: number;
  @Type(() => Number) @IsInt() @Min(10) @Max(120) unpaidMinutes: number;
}

export class SettlementQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

export class PayoutDto {
  @IsUUID() vendorId: string;
  @IsDateString() periodFrom: string;
  @IsDateString() periodTo: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class VendorProfileDto {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) description?: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) location: string;
  @Transform(trim) @Matches(PHONE, { message: 'Enter a valid Ghana phone number.' }) phone: string;
  @IsObject() openingHours: Record<string, Array<[string, string]>>;
  @IsBoolean() acceptsOnline: boolean;
  @IsBoolean() acceptsPayOnPickup: boolean;
  @IsBoolean() offersPickup: boolean;
  @IsBoolean() offersDelivery: boolean;
  @IsOptional() @IsBoolean() useDispatchers?: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000) deliveryFee: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) deliveryNote?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) minimumOrder: number;
  @Type(() => Number) @IsInt() @Min(5) @Max(180) prepMinutes: number;
  @Transform(trim) @IsOptional() @IsIn(['MTN', 'Telecel', 'AirtelTigo']) payoutNetwork?: string;
  @Transform(trim) @IsOptional() @Matches(PHONE, { message: 'Enter a valid mobile money number.' }) payoutNumber?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) payoutName?: string;
}

export class PauseDto {
  @IsBoolean() paused: boolean;
}

export class CategoryDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) position?: number;
}

export class MenuItemDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) description?: string;
  @Type(() => Number) @IsInt() @Min(50) @Max(1_000_000) price: number;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}

export class AvailabilityDto {
  @IsBoolean() isAvailable: boolean;
}

export class VendorActionDto {
  @IsIn(['ACCEPTED', 'REJECTED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED']) to: 'ACCEPTED' | 'REJECTED' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) reason?: string;
  /** The customer's 4-digit collection code, required to complete. */
  @Transform(trim) @IsOptional() @Matches(/^\d{4}$/) code?: string;
}

export class OrderLineDto {
  @IsUUID() menuItemId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) quantity: number;
}

export class PlaceOrderDto {
  @IsUUID() vendorId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => OrderLineDto) lines: OrderLineDto[];
  @IsIn(['PICKUP', 'DELIVERY']) fulfilment: 'PICKUP' | 'DELIVERY';
  @IsIn(['ONLINE', 'ON_PICKUP']) paymentOption: 'ONLINE' | 'ON_PICKUP';
  /** Later today or the next two days, inside opening hours. */
  @IsOptional() @IsDateString() scheduledFor?: string;
  /** Use one meal from this meal plan on this order. */
  @IsOptional() @IsUUID() mealPlanPurchaseId?: string;
  /** Campus-dispatcher deliveries: include the dispatcher's fee in the payment, or pay the dispatcher on delivery. */
  @IsOptional() @IsIn(['INCLUDED', 'ON_DELIVERY']) dispatchFeeMode?: 'INCLUDED' | 'ON_DELIVERY';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) deliveryAddress?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) deliveryNote?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class OrdersQuery extends PaginationDto {}

export class OnlineDto {
  @IsBoolean() online: boolean;
}

export class DeliveredDto {
  @Transform(trim) @Matches(/^\d{4}$/, { message: "Enter the customer's 4-digit code." }) code: string;
}

export class ProblemDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) note: string;
}

export class DispatcherPayoutDto {
  @IsUUID() dispatcherId: string;
  @IsDateString() periodFrom: string;
  @IsDateString() periodTo: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) amount: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class MarkPaidDto {
  @IsIn(['CASH', 'MOMO']) via: 'CASH' | 'MOMO';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) reference?: string;
}

export class RatingDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) vendorStars: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) vendorComment?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) dispatcherStars?: number;
}

export class MealPlanDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name: string;
  @Type(() => Number) @IsInt() @Min(2) @Max(200) meals: number;
  @Type(() => Number) @IsInt() @Min(100) @Max(10_000_000) price: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(180) validDays: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) eligibleItemIds: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class LocationDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100000) accuracy?: number;
}
