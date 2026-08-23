import { truncateAllTables } from './utils/db-cleanup';
import {
  connectPrisma,
  createPrismaTestClient,
  disconnectPrisma,
} from './utils/prisma-test-client';

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
