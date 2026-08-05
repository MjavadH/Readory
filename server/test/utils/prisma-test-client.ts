import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { loadTestEnv } from './load-test-env';

loadTestEnv();

function assertTestDatabase(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for tests');
  }

  const lower = databaseUrl.toLowerCase();
  if (!lower.includes('test')) {
    throw new Error(`Refusing to run tests against a non-test database URL: ${databaseUrl}`);
  }
}

export function createPrismaTestClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  assertTestDatabase(databaseUrl);

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export async function connectPrisma(client: PrismaClient): Promise<void> {
  await client.$connect();
}

export async function disconnectPrisma(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}
