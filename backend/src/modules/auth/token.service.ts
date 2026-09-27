import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { loadEnv } from '../../core/config/env';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}

export interface ChallengePayload {
  sub: string;
  typ: 'mfa_challenge';
  purpose: 'verify' | 'enrol';
}

@Injectable()
export class TokenService {
  private readonly env = loadEnv();

  constructor(private readonly jwt: JwtService) {}

  signAccess(userId: string, sessionId: string) {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, typ: 'access' };
    return this.jwt.signAsync(payload, { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS });
  }

  signChallenge(userId: string, purpose: ChallengePayload['purpose']) {
    const payload: ChallengePayload = { sub: userId, typ: 'mfa_challenge', purpose };
    // Signed with the refresh secret so it can never be accepted as an access token.
    return this.jwt.signAsync(payload, { secret: this.env.JWT_REFRESH_SECRET, expiresIn: this.env.MFA_CHALLENGE_TTL_SECONDS });
  }

  async verifyChallenge(token: string): Promise<ChallengePayload | null> {
    try {
      const p = await this.jwt.verifyAsync<ChallengePayload>(token, { secret: this.env.JWT_REFRESH_SECRET });
      return p.typ === 'mfa_challenge' ? p : null;
    } catch {
      return null;
    }
  }

  private base(): CookieOptions {
    return { httpOnly: true, secure: this.env.NODE_ENV === 'production', sameSite: 'lax' };
  }

  setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(ACCESS_COOKIE, accessToken, { ...this.base(), path: '/', maxAge: this.env.ACCESS_TOKEN_TTL_SECONDS * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...this.base(), path: REFRESH_COOKIE_PATH, maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
  }

  clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.base(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.base(), path: REFRESH_COOKIE_PATH });
  }
}
