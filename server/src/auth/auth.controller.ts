import {Controller, Post, Body, UseGuards, Request, Get, Res} from '@nestjs/common';
import type { Response } from 'express';
import {AuthService} from './auth.service';
import {LocalAuthGuard} from './guards/local-auth.guard';
import {JwtAuthGuard} from './guards/jwt-auth.guard';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {
    }

    // User registration
    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(
            registerDto.email,
            registerDto.username,
            registerDto.password,
        );
    }

    @Post('verify-otp')
    async verifyOtp(@Body() body: { email: string; otp: string }) {
        return this.authService.verifyEmail(body.email, body.otp);
    }

    // User login
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(
        @Request() req: any,
        @Res({ passthrough: true }) response: Response,
        @Body() _loginDto: LoginDto,) {
        const { access_token, user } = await this.authService.login(req.user);
        response.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return {
            message: 'Login successful',
            user: user
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
    getProfile(@Request() req: any) {
        return req.user;
    }
}
