import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    // User registration
    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        const user = await this.authService.register(
            registerDto.email,
            registerDto.password,
        );
        return {
            message: 'Registration successful',
            userId: user.id,
            email: user.email,
        };
    }

    // User login
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req: any, @Body() _loginDto: LoginDto) {
        return this.authService.login(req.user);
    }
}
