import { Injectable } from '@nestjs/common';
import { PublicationStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  POPULARITY_GLOBAL_MEAN,
  POPULARITY_MIN_VOTES,
  RELATED_MAX_FRESHNESS_DAYS,
  TREND_RECENT_PURCHASE_DAYS,
} from './recommendation.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculatePublishedBooksScores(): Promise<void> {
    await this.prisma.$executeRaw`
      WITH recent_purchases AS (
        SELECT
          ar."bookId",
          COUNT(*)::numeric AS "recentPurchasesCount"
        FROM "AccessRecord" ar
               INNER JOIN "Book" pb
                          ON pb.id = ar."bookId"
                            AND pb."publishStatus" = ${PublicationStatus.PUBLISHED}
        WHERE ar."purchasedAt" >=
              NOW() - (${TREND_RECENT_PURCHASE_DAYS} * INTERVAL '1 day')
        GROUP BY ar."bookId"
      ),
           source AS (
             SELECT
               b.id,
               GREATEST(0.0, LEAST(5.0, b."ratingAvg"::numeric)) AS "ratingAvg",
               GREATEST(0, b."ratingCount")::numeric AS "ratingCount",
               GREATEST(0, b."favoriteCount")::numeric AS "favoriteCount",
               COALESCE(b."lastContentUpdate", b."createdAt") AS "contentDate",
               COALESCE(rp."recentPurchasesCount", 0)::numeric AS "recentPurchasesCount"
             FROM "Book" b
                    LEFT JOIN recent_purchases rp
                              ON rp."bookId" = b.id
             WHERE b."publishStatus" = ${PublicationStatus.PUBLISHED}
           ),
           weighted AS (
             SELECT
               *,
               (
                 (
                   "ratingCount" / NULLIF("ratingCount" + ${POPULARITY_MIN_VOTES}::numeric, 0)
                   ) * "ratingAvg"
                 )
                 +
               (
                 (
                   ${POPULARITY_MIN_VOTES}::numeric / NULLIF("ratingCount" + ${POPULARITY_MIN_VOTES}::numeric, 0)
                   ) * ${POPULARITY_GLOBAL_MEAN}::numeric
           ) AS "weightedRating"
      FROM source
        ),
        scored AS (
      SELECT
        id,

        LEAST(
        100.0,
        GREATEST(
        0.0,
        (
        (
        ("weightedRating" / 5.0) * 40.0
        +
        LEAST(20.0, LOG(2.0::numeric, ("favoriteCount" + 1.0)::numeric) * 3.5)
        +
        LEAST(10.0, LOG(10.0::numeric, ("ratingCount" + 1.0)::numeric) * 5.0)
        )
        / 70.0
        ) * 100.0
        )
        ) AS "popularityScore",

        LEAST(
        100.0,
        GREATEST(
        0.0,
        ("weightedRating" / 5.0) * 40.0
        +
        LEAST(20.0, LOG(2.0::numeric, ("favoriteCount" + 1.0)::numeric) * 3.5)
        +
        LEAST(10.0, LOG(10.0::numeric, ("ratingCount" + 1.0)::numeric) * 5.0)
        +
        (
        LEAST(
        1.0,
        GREATEST(
        0.0,
        1.0 - (EXTRACT(EPOCH FROM (NOW() - "contentDate")) / 86400.0) / ${RELATED_MAX_FRESHNESS_DAYS}::numeric
        )
        ) * 10.0
        )
        +
        LEAST(20.0, LOG(2.0::numeric, ("recentPurchasesCount" + 1.0)::numeric) * 4.0)
        )
        ) AS "trendScore"

      FROM weighted
        )
      UPDATE "Book" b
      SET
        "popularityScore" = ROUND(scored."popularityScore"::numeric, 4),
        "trendScore" = ROUND(scored."trendScore"::numeric, 4)
        FROM scored
      WHERE b.id = scored.id
    `;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateRecommendationScoresJob(): Promise<void> {
    await this.recalculatePublishedBooksScores();
  }
}
