import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class StudentLoginDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(/^ANU\d{2}[0-9A-Z]{1,3}\d{5}$/, { message: 'Enter your index number, for example ANU25400001.' })
  indexNumber: string;

  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

export class StaffLoginDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

export class MfaChallengeDto {
  @IsString() @MaxLength(2000) challengeToken: string;
}

export class MfaCodeDto extends MfaChallengeDto {
  /** A 6-digit authenticator code, or a recovery code such as ABCDE-FGHIJ. */
  @IsString() @MinLength(6) @MaxLength(11) code: string;
}

export class StepUpDto {
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator app.' })
  code: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword: string;
}

export class ForgotPasswordDto {
  /** Index number (students) or email (staff). */
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString() @MinLength(3) @MaxLength(200) identifier: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code we sent you.' }) code: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword: string;
}

export class SwitchRoleDto {
  @IsString() @MaxLength(60) roleKey: string;
}
