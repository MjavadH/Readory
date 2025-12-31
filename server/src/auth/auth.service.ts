import { Injectable, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    // Validate user credentials for login
    async validateUser(email: string, password: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return null;
        }
        const isValid = await argon2.verify(user.passwordHash, password);
        if (!isValid) {
            return null;
        }
        return user;
    }

    // Register a new user
    async register(email: string, password: string) {
        const existing = await this.usersService.findByEmail(email);
        if (existing) {
            throw new ConflictException('Email already registered');
        }
        const hash = await argon2.hash(password);
        return this.usersService.createUser(email, hash);
    }

    // Issue a JWT for an authenticated user
    async login(user: any) {
        const fullUser = await this.usersService.findById(user.id);
        if (!fullUser) {
            throw new Error('User not found');
        }
        const payload = {
            sub: fullUser.id,
            email: fullUser.email,
            roleName: fullUser.role?.name, // add roleName
        };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
}
