import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  sessionId: string;
  type: 'STUDENT' | 'STAFF' | 'PARTNER';
  activeRoleKey: string | null;
  mfaVerifiedAt: Date | null;
  label: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
