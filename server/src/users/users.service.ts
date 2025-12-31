import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            include: { role: true }, // now role.name is available
        });
    }

    async createUser(email: string, passwordHash: string) {
        // Ensure the "USER" role exists (create it if not)
        const role = await this.prisma.role.upsert({
            where: { name: 'USER' },
            update: {},
            create: { name: 'USER' },
        });

        // Create user along with an associated wallet with zero balance
        const user = await this.prisma.user.create({
            data: {
                email,
                passwordHash,
                roleId: role.id,
                wallet: {
                    create: {
                        balance: 0,
                    },
                },
            },
        });

        return user;
    }
}
