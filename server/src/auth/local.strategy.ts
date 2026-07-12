import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthSecurityService } from './security/auth-security.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private authSecurityService: AuthSecurityService,
  ) {
    super({ usernameField: 'identifier', passReqToCallback: true });
  }

  async validate(
    req: Request,
    identifier: string,
    password: string,
  ): Promise<any> {
    await this.authSecurityService.assertLoginAllowed(identifier, req);
    const user = await this.authService.validateUser(identifier, password);
    if (!user) {
      await this.authSecurityService.recordLoginFailure(identifier, req);
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.authSecurityService.recordLoginSuccess(identifier, req);
    return user;
  }
}
