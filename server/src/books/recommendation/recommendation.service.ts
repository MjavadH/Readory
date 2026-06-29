import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
    POPULARITY_GLOBAL_MEAN,
    POPULARITY_MIN_VOTES,
    RELATED_MAX_FRESHNESS_DAYS,
} from './recommendation.constants';

@Injectable()
export class RecommendationService {

    calculateFreshnessScore(updatedAt: Date): number {
        const ageDays =
            (Date.now() - updatedAt.getTime()) /
            86400000;

        if (ageDays >= RELATED_MAX_FRESHNESS_DAYS) {
            return 0;
        }

        return (
            1 -
            ageDays / RELATED_MAX_FRESHNESS_DAYS
        );
    }

    calculatePopularityScore(args: {
        ratingAvg: Prisma.Decimal | number;
        ratingCount: number;
        favoriteCount: number;
        lastContentUpdate: Date;
    }) {
        const ratingAvg = Number(args.ratingAvg);

        const weightedRating =
            (args.ratingCount /
                (args.ratingCount +
                    POPULARITY_MIN_VOTES)) *
            ratingAvg +
            (POPULARITY_MIN_VOTES /
                (args.ratingCount +
                    POPULARITY_MIN_VOTES)) *
            POPULARITY_GLOBAL_MEAN;

        const ratingScore =
            (weightedRating / 5) * 50;

        const favoriteScore = Math.min(
            30,
            Math.log2(args.favoriteCount + 1) * 5,
        );

        const confidenceScore = Math.min(
            10,
            Math.log10(args.ratingCount + 1) * 5,
        );

        const freshnessScore =
            this.calculateFreshnessScore(
                args.lastContentUpdate,
            ) * 10;

        return (
            ratingScore +
            favoriteScore +
            confidenceScore +
            freshnessScore
        );
    }

    async recalculatePopularity(
        tx: Prisma.TransactionClient,
        bookId: number,
    ) {
        const book = await tx.book.findUnique({
            where: { id: bookId },
            select: {
                ratingAvg: true,
                ratingCount: true,
                favoriteCount: true,
                lastContentUpdate: true,
                updatedAt: true,
            },
        });

        if (!book) {
            return;
        }

        const updated =
            book.lastContentUpdate ?? book.updatedAt;

        const popularityScore =
            this.calculatePopularityScore({
                ratingAvg: book.ratingAvg,
                ratingCount: book.ratingCount,
                favoriteCount: book.favoriteCount,
                lastContentUpdate: updated,
            });

        await tx.book.update({
            where: { id: bookId },
            data: {
                popularityScore: new Prisma.Decimal(
                    popularityScore.toFixed(4),
                ),
            },
        });
    }
}