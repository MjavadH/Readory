import { Injectable } from '@nestjs/common';
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
    async validateUser(identifier: string, password: string) {
        const user = await this.usersService.findUserByIdentifier(identifier);
        if (!user) {
            return null;
        }
        const isValid = await argon2.verify(user.passwordHash, password);
        if (!isValid) {
            return null;
        }
        return user;
    }

    async verifyEmail(email: string, otp: string) {
        return this.usersService.verifyAndCreateUser(email, otp);
    }

    // Register a new user
    async register(email: string, username: string, password: string) {
        const hash = await argon2.hash(password);
        return this.usersService.registerTemporaryUser(email, username, hash);
    }

    async login(user: any) {
        const fullUser = await this.usersService.findById(user.id);
        if (!fullUser) {throw new Error('User not found');}

        this.usersService.updateLastLogin(fullUser.id);
        
        const payload = {
            sub: fullUser.id,
            email: fullUser.email,
            username: fullUser.username,
            roleName: fullUser.role?.name,
        };
        return {
            access_token: await this.jwtService.signAsync(payload),
            user: {
                id: fullUser.id,
                email: fullUser.email,
                username: fullUser.username,
                roleName: fullUser.role?.name
            }
        };
    }
}
