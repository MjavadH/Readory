import { Controller, Post, Body, UseGuards, Request, Get, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthSecurityService } from './security/auth-security.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authSecurityService: AuthSecurityService,
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
    const { access_token, user } = await this.authService.verifyEmail(body.email, body.otp);
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
    const { access_token, user } = await this.authService.login(req.user);
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Login successful',
      user: user,
    };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) response: Response) {
    const { access_token, user, created } = await this.authService.googleLogin(dto.credential);
    response.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      message: created ? 'Account created' : 'Login successful',
      user,
      created,
    };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
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
