import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { LoginService } from './login.service';
import { AccountService } from './account.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { MfaService } from './mfa.service';

@Global()
@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [LoginService, AccountService, SessionService, TokenService, PasswordService, MfaService],
  exports: [PasswordService],
})
export class AuthModule {}
