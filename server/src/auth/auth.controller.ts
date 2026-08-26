import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleOriginGuard } from './google-origin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthSecurityService } from './security/auth-security.service';
import { SessionService } from './sessions/session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authSecurityService: AuthSecurityService,
    private sessionService: SessionService,
  ) {}

  // User registration
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Request() req: any) {
    await this.authSecurityService.assertRegistrationAllowed(registerDto.email, req);
    return this.authService.register(registerDto.email, registerDto.username, registerDto.password);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authSecurityService.assertVerificationAllowed(body.email, req);
    const { access_token, access_token_max_age, user } = await this.authService.verifyEmail(
      body.email,
      body.otp,
      req,
      response,
    );
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: access_token_max_age,
    });

    return {
      message: 'Account verified',
      user,
    };
  }

  // User login
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
    @Body() _loginDto: LoginDto,
  ) {
    const { access_token, access_token_max_age, user } = await this.authService.login(
      req.user,
      req,
      response,
    );
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: access_token_max_age,
    });

    return {
      message: 'Login successful',
      user: user,
    };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(GoogleOriginGuard)
  @Post('google')
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.googleLogin(dto.credential, dto.nonce, req, response);
    if ('requiresLink' in result) return result;
    const { access_token, access_token_max_age, user, created } = result;
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: access_token_max_age,
      path: '/',
    });

    return {
      message: created ? 'Account created' : 'Login successful',
      user,
      created,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GoogleOriginGuard)
  @Post('google/link')
  async linkGoogle(
    @Body() dto: LinkGoogleDto,
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { access_token, access_token_max_age, user, linked } = await this.authService.linkGoogle(
      dto.credential,
      dto.nonce,
      dto.password,
      req,
      response,
    );
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: access_token_max_age,
      path: '/',
    });

    return {
      message: linked ? 'Google account linked successfully' : 'Login successful',
      user,
      linked,
    };
  }

  @Post('refresh')
  async refresh(@Request() req: any, @Res({ passthrough: true }) response: Response) {
    const { accessToken, accessTokenMaxAgeMs } = await this.authService.rotateRefreshToken(
      req.cookies?.refresh_token,
      req,
      response,
    );
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessTokenMaxAgeMs,
      path: '/',
    });
    return { message: 'Token refreshed' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any, @Res({ passthrough: true }) response: Response) {
    if (req.user?.sessionId) {
      await this.sessionService.revokeSession(
        req.user.userId,
        req.user.sessionId,
        req.user.sessionId,
      );
    }
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@Request() req: any) {
    return this.sessionService.listSessions(req.user.userId, req.user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/others')
  async revokeOtherSessions(@Request() req: any) {
    await this.sessionService.revokeOtherSessions(req.user.userId, req.user.sessionId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @Request() req: any) {
    await this.sessionService.revokeSession(req.user.userId, id, req.user.sessionId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Request() req: any) {
    await this.authSecurityService.assertForgotPasswordAllowed(dto.email, req);
    await this.authService.forgotPassword(dto.email);
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Request() req: any) {
    await this.authSecurityService.assertResetPasswordAllowed(req);
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      message: 'Password has been successfully updated.',
    };
  }
}
