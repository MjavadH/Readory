import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seeding...');

  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  console.log('✅ Roles created/verified.');

  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD env var is required (min 8 chars)');
  }
  const passwordHash = await argon2.hash(seedPassword);

  const admin = await prisma.user.upsert({
    where: { email: 'MjavadH@gmail.com' }, // Only @gmail.com
    update: {},
    create: {
      email: 'MjavadH@gmail.com',
      username: 'MjavadH',
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
    await pool.end();
  });
