import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { CacheEnvelope, CacheGetOrSetOptions, CacheObserveContext } from './cache.types';
import { CacheSerializer } from './cache.serializer';

@Injectable()
export class CacheManager {
  private readonly logger = new Logger(CacheManager.name);
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  sanitizeSegment(segment: string | number | boolean): string {
    return String(segment)
      .trim()
      .replace(/[^a-zA-Z0-9:_\-]/g, '_')
      .slice(0, 120);
  }

  buildKey(namespace: string, ...segments: Array<string | number | boolean>): string {
    const safeNamespace = this.sanitizeSegment(namespace);
    const safeSegments = segments.map((segment) => this.sanitizeSegment(segment));
    return [safeNamespace, ...safeSegments].join(':');
  }

  buildHashedKey(namespace: string, payload: unknown): string {
    const safeNamespace = this.sanitizeSegment(namespace);
    const fingerprint = createHash('sha256')
      .update(CacheSerializer.stringify(payload))
      .digest('hex')
      .slice(0, 32);

    return `${safeNamespace}:${fingerprint}`;
  }

  async getVersion(versionKey: string): Promise<string> {
    const safeVersionKey = this.sanitizeSegment(versionKey);

    try {
      const value = await this.redis.get(safeVersionKey);
      return value ?? '0';
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeVersionKey,
        elapsedMs: 0,
        detail: `version-read-failure:${(error as Error).message}`,
      });
      return '0';
    }
  }

  async getString(key: string): Promise<string | null> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    try {
      const value = await this.redis.get(safeKey);
      this.observe({
        operation: value === null ? 'miss' : 'hit',
        key: safeKey,
        elapsedMs: Date.now() - start,
      });
      return value;
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeKey,
        elapsedMs: Date.now() - start,
        detail: `cache-read-failure:${(error as Error).message}`,
      });
      return null;
    }
  }

  async setString(
    key: string,
    value: string,
    ttlSeconds: number,
    jitterPercent = 0.1,
  ): Promise<void> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    try {
      const ttlWithJitter = this.computePercentJitteredTtl(ttlSeconds, jitterPercent);
      await this.redis.set(safeKey, value, 'EX', ttlWithJitter);
      this.observe({ operation: 'set', key: safeKey, elapsedMs: Date.now() - start });
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeKey,
        elapsedMs: Date.now() - start,
        detail: `cache-write-failure:${(error as Error).message}`,
      });
    }
  }

  async del(key: string): Promise<void> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    try {
      await this.redis.del(safeKey);
      this.observe({ operation: 'invalidate', key: safeKey, elapsedMs: Date.now() - start });
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeKey,
        elapsedMs: Date.now() - start,
        detail: `cache-delete-failure:${(error as Error).message}`,
      });
    }
  }

  async incr(key: string): Promise<number> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    try {
      const value = await this.redis.incr(safeKey);
      this.observe({ operation: 'set', key: safeKey, elapsedMs: Date.now() - start });
      return value;
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeKey,
        elapsedMs: Date.now() - start,
        detail: `cache-incr-failure:${(error as Error).message}`,
      });
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    try {
      await this.redis.expire(safeKey, ttlSeconds);
      this.observe({ operation: 'set', key: safeKey, elapsedMs: Date.now() - start });
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeKey,
        elapsedMs: Date.now() - start,
        detail: `cache-expire-failure:${(error as Error).message}`,
      });
    }
  }

  async bumpVersion(versionKey: string): Promise<void> {
    const safeVersionKey = this.sanitizeSegment(versionKey);
    const start = Date.now();

    try {
      await this.redis.incr(safeVersionKey);
      this.observe({ operation: 'invalidate', key: safeVersionKey, elapsedMs: Date.now() - start });
    } catch (error) {
      this.observe({
        operation: 'error',
        key: safeVersionKey,
        elapsedMs: Date.now() - start,
        detail: `version-bump-failure:${(error as Error).message}`,
      });
    }
  }

  async getOrSet<T>(
    key: string,
    options: CacheGetOrSetOptions,
    loader: () => Promise<T>,
  ): Promise<T> {
    const safeKey = this.sanitizeSegment(key);
    const start = Date.now();

    if (!options.skipCacheRead) {
      try {
        const cached = await this.redis.get(safeKey);
        if (cached) {
          const envelope = CacheSerializer.parse<CacheEnvelope<T>>(cached);
          this.observe({ operation: 'hit', key: safeKey, elapsedMs: Date.now() - start });

          if (this.shouldRefreshEarly(envelope.expiresAtMs, options.earlyRefreshWindowSeconds)) {
            void this.singleflight(`refresh:${safeKey}`, async () => {
              const fresh = await loader();
              await this.writeEnvelope(safeKey, fresh, options);
              return fresh;
            });
          }

          return envelope.data;
        }

        this.observe({ operation: 'miss', key: safeKey, elapsedMs: Date.now() - start });
      } catch (error) {
        this.observe({
          operation: 'error',
          key: safeKey,
          elapsedMs: Date.now() - start,
          detail: `cache-read-failure:${(error as Error).message}`,
        });
      }
    }

    return this.singleflight(safeKey, async () => {
      const loaded = await loader();

      try {
        await this.writeEnvelope(safeKey, loaded, options);
      } catch (error) {
        this.observe({
          operation: 'error',
          key: safeKey,
          elapsedMs: Date.now() - start,
          detail: `cache-write-failure:${(error as Error).message}`,
        });
      }

      return loaded;
    });
  }

  private async writeEnvelope<T>(
    safeKey: string,
    value: T,
    options: CacheGetOrSetOptions,
  ): Promise<void> {
    const ttlSeconds = this.computeJitteredTtl(options.ttlSeconds, options.jitterSeconds ?? 3);
    const nowMs = Date.now();
    const envelope: CacheEnvelope<T> = {
      data: value,
      expiresAtMs: nowMs + ttlSeconds * 1000,
    };

    const start = Date.now();
    await this.redis.set(safeKey, CacheSerializer.stringify(envelope), 'EX', ttlSeconds);
    this.observe({ operation: 'set', key: safeKey, elapsedMs: Date.now() - start });
  }

  private async singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const activePromise = this.inflight.get(key) as Promise<T> | undefined;
    if (activePromise) {
      return activePromise;
    }

    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise as Promise<unknown>);
    return promise;
  }

  private shouldRefreshEarly(expiresAtMs: number, earlyWindowSeconds?: number): boolean {
    if (!earlyWindowSeconds || earlyWindowSeconds <= 0) {
      return false;
    }

    const remainingMs = expiresAtMs - Date.now();
    const windowMs = earlyWindowSeconds * 1000;
    if (remainingMs > windowMs) {
      return false;
    }

    const probability = Math.max(0.05, 1 - remainingMs / windowMs);
    return Math.random() < probability;
  }

  private computeJitteredTtl(baseTtlSeconds: number, jitterSeconds: number): number {
    if (jitterSeconds <= 0) {
      return baseTtlSeconds;
    }

    const jitter = Math.floor(Math.random() * (2 * jitterSeconds + 1)) - jitterSeconds;
    return Math.max(1, baseTtlSeconds + jitter);
  }

  private computePercentJitteredTtl(baseTtlSeconds: number, jitterPercent: number): number {
    const boundedPercent = Math.min(0.1, Math.max(0.05, jitterPercent));
    const maxJitter = Math.max(1, Math.floor(baseTtlSeconds * boundedPercent));
    return this.computeJitteredTtl(baseTtlSeconds, maxJitter);
  }

  private observe(context: CacheObserveContext): void {
    const message = JSON.stringify(context);

    if (context.operation === 'error') {
      this.logger.error(message);
      return;
    }

    this.logger.log(message);
  }
}
