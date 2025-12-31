import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class WalletsService {
    constructor(private prisma: PrismaService) {}

    // Get a user’s wallet and balance
    async getWallet(userId: number) {
        const wallet = await this.prisma.wallet.findUnique({
            where: { userId },
            include: { transactions: true },
        });
        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }
        return wallet;
    }

    // Credit the wallet with a certain amount
    async credit(userId: number, amount: number, reference?: string) {
        // Ensure amount is positive
        if (amount <= 0) {
            throw new ForbiddenException('Amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            // Get current wallet
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }
            // Update balance
            const updatedWallet = await tx.wallet.update({
                where: { userId },
                data: { balance: { increment: amount } },
            });
            // Add transaction record
            await tx.walletTransaction.create({
                data: {
                    walletId: updatedWallet.id,
                    amount,
                    type: TransactionType.CREDIT,
                    reference,
                },
            });
            return updatedWallet;
        });
    }

    // Debit the wallet (used when buying a chapter)
    async debit(userId: number, amount: number, reference?: string) {
        if (amount <= 0) {
            throw new ForbiddenException('Amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }
            if (wallet.balance.toNumber() < amount) {
                throw new ForbiddenException('Insufficient balance');
            }
            const updatedWallet = await tx.wallet.update({
                where: { userId },
                data: { balance: { decrement: amount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: updatedWallet.id,
                    amount,
                    type: TransactionType.DEBIT,
                    reference,
                },
            });
            return updatedWallet;
        });
    }
}
