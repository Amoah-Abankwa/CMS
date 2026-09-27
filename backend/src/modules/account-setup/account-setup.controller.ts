import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AccountSetupService } from './account-setup.service';

class SetupTokenDto {
  @IsString() @MinLength(20) @MaxLength(100) token: string;
}

class CompleteSetupDto extends SetupTokenDto {
  @IsString() @MinLength(10) @MaxLength(200) password: string;
}

@Controller('auth/setup')
export class AccountSetupController {
  constructor(private readonly setup: AccountSetupService) {}

  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @HttpCode(200)
  @Post('verify')
  verify(@Body() dto: SetupTokenDto) {
    return this.setup.describe(dto.token);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('complete')
  complete(@Body() dto: CompleteSetupDto) {
    return this.setup.complete(dto.token, dto.password);
  }
}
