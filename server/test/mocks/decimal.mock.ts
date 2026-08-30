import { Prisma } from '@prisma/client';

/**
 * Builds a genuine `Prisma.Decimal`.
 *
 * Money columns (wallet balances, transaction amounts, prices) come back from
 * Prisma as `Decimal`, not `number`. Services rely on that: e.g.
 * WalletsService.debit calls `updatedWallet.balance.toNumber()`.
 *
 * Seeding a plain JS number in a test therefore produces
 * `TypeError: balance.toNumber is not a function` — a mock-fidelity bug, not a
 * source bug. Using the real Decimal class keeps arithmetic and rounding
 * behaviour identical to production instead of approximating it with a stub.
 */
export function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
