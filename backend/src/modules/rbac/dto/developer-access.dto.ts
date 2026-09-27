import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class EnableDeveloperDto {
  @IsUUID() userId: string;
  @IsString() @MinLength(10) @MaxLength(500) reason: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class DisableDeveloperDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}
