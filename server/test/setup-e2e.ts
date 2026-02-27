import { createPrismaTestClient, connectPrisma, disconnectPrisma } from './utils/prisma-test-client';
import { truncateAllTables } from './utils/db-cleanup';

const prisma = createPrismaTestClient();

beforeAll(async () => {
  await connectPrisma(prisma);
});

beforeEach(async () => {
  await truncateAllTables(prisma);
});

afterAll(async () => {
  await disconnectPrisma(prisma);
});
