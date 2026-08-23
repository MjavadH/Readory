import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { RATE_LIMITS } from '../../rate-limit/rate-limit.constants';
import type { RateLimitService } from '../../rate-limit/rate-limit.service';

@Injectable()
export class AuthSecurityService {
  constructor(private readonly rateLimit: RateLimitService) {}

  async assertLoginAllowed(identifier: string, req: Request) {
    const emailHash = this.rateLimit.emailKey(identifier);
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.assertNotLocked(
      this.rateLimit.key('auth', 'login-lock', 'email', emailHash),
      'This account is temporarily locked due to failed login attempts.',
    );
    await this.rateLimit.assertNotLocked(
      this.rateLimit.key('auth', 'login-lock', 'ip', ip),
      'This IP is temporarily locked due to failed login attempts.',
    );
  }

  async recordLoginFailure(identifier: string, req: Request) {
    const emailHash = this.rateLimit.emailKey(identifier);
    const ip = this.rateLimit.ipFromRequest(req);
    const emailLimit = RATE_LIMITS.auth.loginEmail;
    const ipLimit = RATE_LIMITS.auth.loginIp;
    const emailKey = this.rateLimit.key('auth', 'login-fail', 'email', emailHash);
    const ipKey = this.rateLimit.key('auth', 'login-fail', 'ip', ip);
    const emailAttempts = await this.rateLimit
      .consume({
        key: emailKey,
        limit: emailLimit.limit,
        ttlSeconds: emailLimit.ttlSeconds,
        message: 'Too many failed login attempts for this account.',
      })
      .catch(async (error) => {
        await this.rateLimit.lock(
          this.rateLimit.key('auth', 'login-lock', 'email', emailHash),
          emailLimit.lockSeconds,
        );
        throw error;
      });
    if (emailAttempts >= emailLimit.limit)
      await this.rateLimit.lock(
        this.rateLimit.key('auth', 'login-lock', 'email', emailHash),
        emailLimit.lockSeconds,
      );

    const ipAttempts = await this.rateLimit
      .consume({
        key: ipKey,
        limit: ipLimit.limit,
        ttlSeconds: ipLimit.ttlSeconds,
        message: 'Too many failed login attempts from this IP.',
      })
      .catch(async (error) => {
        await this.rateLimit.lock(
          this.rateLimit.key('auth', 'login-lock', 'ip', ip),
          ipLimit.lockSeconds,
        );
        throw error;
      });
    if (ipAttempts >= ipLimit.limit)
      await this.rateLimit.lock(
        this.rateLimit.key('auth', 'login-lock', 'ip', ip),
        ipLimit.lockSeconds,
      );
  }

  async recordLoginSuccess(identifier: string, req: Request) {
    const emailHash = this.rateLimit.emailKey(identifier);
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.reset(
      this.rateLimit.key('auth', 'login-fail', 'email', emailHash),
      this.rateLimit.key('auth', 'login-fail', 'ip', ip),
      this.rateLimit.key('auth', 'login-lock', 'email', emailHash),
    );
  }

  async assertRegistrationAllowed(email: string, req: Request) {
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'register', 'ip', ip),
      ...RATE_LIMITS.auth.registerIp,
      message: 'Too many registration attempts from this IP.',
    });
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'register', 'email', this.rateLimit.emailKey(email)),
      ...RATE_LIMITS.auth.registerEmail,
      message: 'Too many registration attempts for this email.',
    });
  }

  async assertVerificationAllowed(email: string, req: Request) {
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'verify', 'ip', ip),
      ...RATE_LIMITS.auth.verifyEmail,
      message: 'Too many verification attempts.',
    });
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'verify', 'email', this.rateLimit.emailKey(email)),
      ...RATE_LIMITS.auth.verifyEmail,
      message: 'Too many verification attempts.',
    });
  }

  async assertForgotPasswordAllowed(email: string, req: Request) {
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'forgot', 'ip', ip),
      ...RATE_LIMITS.auth.forgotPassword,
      message: 'Too many password reset requests from this IP.',
    });
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'forgot', 'email', this.rateLimit.emailKey(email)),
      ...RATE_LIMITS.auth.forgotPassword,
      message: 'Too many password reset requests for this email.',
    });
  }

  async assertResetPasswordAllowed(req: Request) {
    const ip = this.rateLimit.ipFromRequest(req);
    await this.rateLimit.consume({
      key: this.rateLimit.key('auth', 'reset', 'ip', ip),
      ...RATE_LIMITS.auth.resetPassword,
      message: 'Too many password reset attempts from this IP.',
    });
  }
}
