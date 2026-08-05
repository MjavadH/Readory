import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import type { Request } from 'express';

type LimitOptions = {
  key: string;
  limit: number;
  ttlSeconds: number;
  message?: string;
};

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  key(...parts: Array<string | number | undefined | null>): string {
    return [
      'rl',
      ...parts
        .filter((part) => part !== undefined && part !== null)
        .map((part) => this.sanitize(String(part))),
    ].join(':');
  }

  emailKey(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
  }

  ipFromRequest(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return (first || req.ip || req.socket.remoteAddress || 'unknown').trim();
  }

  async consume(options: LimitOptions): Promise<number> {
    const safeKey = this.sanitizeKey(options.key);
    try {
      const count = await this.redis.incr(safeKey);
      if (count === 1) await this.redis.expire(safeKey, options.ttlSeconds);
      if (count > options.limit) {
        const ttl = await this.redis.ttl(safeKey);
        throw new HttpException(
          options.message ?? `Too many requests. Try again in ${Math.max(ttl, 1)} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return count;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Rate limit failure for ${safeKey}: ${(error as Error).message}`);
      return 0;
    }
  }

  async assertNotLocked(
    key: string,
    message = 'Too many attempts. Please try again later.',
  ): Promise<void> {
    const ttl = await this.redis.ttl(this.sanitizeKey(key));
    if (ttl > 0)
      throw new HttpException(`${message} Retry in ${ttl} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
  }

  async lock(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.sanitizeKey(key), '1', 'EX', ttlSeconds);
  }

  async reset(...keys: string[]): Promise<void> {
    const safe = keys.map((key) => this.sanitizeKey(key));
    if (safe.length) await this.redis.del(...safe);
  }

  private sanitizeKey(key: string): string {
    return key
      .split(':')
      .map((part) => this.sanitize(part))
      .join(':');
  }
  private sanitize(value: string): string {
    return (
      value
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 160) || 'blank'
    );
  }
}
