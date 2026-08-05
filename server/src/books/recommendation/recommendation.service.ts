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
    const ageDays = (Date.now() - updatedAt.getTime()) / 86400000;

    if (ageDays >= RELATED_MAX_FRESHNESS_DAYS) {
      return 0;
    }

    return 1 - ageDays / RELATED_MAX_FRESHNESS_DAYS;
  }

  calculatePopularityScore(args: {
    ratingAvg: Prisma.Decimal | number;
    ratingCount: number;
    favoriteCount: number;
    lastContentUpdate: Date;
    recentPurchasesCount: number;
  }) {
    const ratingAvg = Number(args.ratingAvg);

    const weightedRating =
      (args.ratingCount / (args.ratingCount + POPULARITY_MIN_VOTES)) * ratingAvg +
      (POPULARITY_MIN_VOTES / (args.ratingCount + POPULARITY_MIN_VOTES)) * POPULARITY_GLOBAL_MEAN;

    // Max 40 points
    const ratingScore = (weightedRating / 5) * 40;

    // Max 20 points
    const favoriteScore = Math.min(20, Math.log2(args.favoriteCount + 1) * 3.5);

    // Max 10 points
    const confidenceScore = Math.min(10, Math.log10(args.ratingCount + 1) * 5);

    // Max 10 points
    const freshnessScore = this.calculateFreshnessScore(args.lastContentUpdate) * 10;

    // Max 20 points - Logarithmic scaling for recent purchases
    const purchaseScore = Math.min(20, Math.log2(args.recentPurchasesCount + 1) * 4);

    return ratingScore + favoriteScore + confidenceScore + freshnessScore + purchaseScore;
  }

  async recalculatePopularity(tx: Prisma.TransactionClient, bookId: number) {
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

    // Count purchases in the last 14 days for dynamic trending
    const choiceDate = new Date();
    choiceDate.setDate(choiceDate.getDate() - 14);

    const recentPurchasesCount = await tx.accessRecord.count({
      where: {
        bookId: bookId,
        purchasedAt: { gte: choiceDate },
      },
    });

    const updated = book.lastContentUpdate ?? book.updatedAt;

    const popularityScore = this.calculatePopularityScore({
      ratingAvg: book.ratingAvg,
      ratingCount: book.ratingCount,
      favoriteCount: book.favoriteCount,
      lastContentUpdate: updated,
      recentPurchasesCount,
    });

    await tx.book.update({
      where: { id: bookId },
      data: {
        popularityScore: new Prisma.Decimal(popularityScore.toFixed(4)),
      },
    });
  }
}
