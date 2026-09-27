import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { REFRESH_COOKIE } from './auth.constants';
import { LoginService } from './login.service';
import { AccountService } from './account.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import {
  ChangePasswordDto, ForgotPasswordDto, MfaChallengeDto, MfaCodeDto, ResetPasswordDto,
  StaffLoginDto, StepUpDto, StudentLoginDto, SwitchRoleDto,
} from './dto/auth.dto';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginService,
    private readonly account: AccountService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('student/login')
  async studentLogin(@Body() dto: StudentLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.login.studentLogin(dto.indexNumber, dto.password);
    this.tokens.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { status: result.status, mustChangePassword: result.mustChangePassword };
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('staff/login')
  staffLogin(@Body() dto: StaffLoginDto) {
    return this.login.staffLogin(dto.email, dto.password);
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('mfa/verify')
  async verifyMfa(@Body() dto: MfaCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.login.completeMfa(dto.challengeToken, dto.code);
    this.tokens.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { status: 'signed_in', mustChangePassword: result.mustChangePassword, usedRecoveryCode: result.usedRecoveryCode };
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('mfa/enrol/start')
  startEnrolment(@Body() dto: MfaChallengeDto) {
    return this.login.startEnrolment(dto.challengeToken);
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('mfa/enrol/confirm')
  async confirmEnrolment(@Body() dto: MfaCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.login.confirmEnrolment(dto.challengeToken, dto.code);
    this.tokens.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { status: 'signed_in', mustChangePassword: result.mustChangePassword, recoveryCodes: result.recoveryCodes };
  }

  @Public() @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const issued = await this.sessions.refresh(req.cookies?.[REFRESH_COOKIE]);
      this.tokens.setCookies(res, issued.accessToken, issued.refreshToken);
      return { ok: true };
    } catch (err) {
      this.tokens.clearCookies(res);
      throw err;
    }
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(user.sessionId);
    await this.audit.record({ action: 'auth.logout', module: 'auth' });
    this.tokens.clearCookies(res);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.account.me(user);
  }

  @HttpCode(200)
  @Post('switch-role')
  async switchRole(@CurrentUser() user: AuthUser, @Body() dto: SwitchRoleDto) {
    await this.account.switchRole(user, dto.roleKey);
    return { ok: true };
  }

  @Throttle(STRICT) @HttpCode(200)
  @Post('mfa/step-up')
  async stepUp(@CurrentUser() user: AuthUser, @Body() dto: StepUpDto) {
    await this.account.stepUp(user, dto.code);
    return { ok: true };
  }

  @Throttle(STRICT) @HttpCode(200)
  @Post('password/change')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.account.changePassword(user, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Public() @Throttle({ default: { limit: 3, ttl: 60_000 } }) @HttpCode(200)
  @Post('password/forgot')
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.account.forgotPassword(dto.identifier);
    return { ok: true, message: 'If an account matches, a reset code has been sent to its email and phone.' };
  }

  @Public() @Throttle(STRICT) @HttpCode(200)
  @Post('password/reset')
  async reset(@Body() dto: ResetPasswordDto) {
    await this.account.resetPassword(dto.identifier, dto.code, dto.newPassword);
    return { ok: true };
  }

  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthUser) {
    const sessions = await this.sessions.listActive(user.id);
    return sessions.map((s) => ({ ...s, current: s.id === user.sessionId }));
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const owned = (await this.sessions.listActive(user.id)).some((s) => s.id === id);
    if (owned) {
      await this.sessions.revoke(id);
      await this.audit.record({ action: 'auth.session.revoked', module: 'auth', targetType: 'Session', targetId: id });
    }
    return { ok: true };
  }
}
