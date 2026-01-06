import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({});

async function main() {
    console.log('🌱 Starting seeding...');

    const adminRole = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN' },
    });

    const userRole = await prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: { name: 'USER' },
    });

    console.log('✅ Roles created/verified.');

    const passwordHash = await argon2.hash('MjavadH');

    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {},
        create: {
            email: 'admin@gmail.com',
            username: 'superadmin',
            passwordHash,
            roleId: adminRole.id,
            wallet: {
                create: { balance: 999999 },
            },
        },
    });

    console.log(`✅ Admin user created: ${admin.email}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });