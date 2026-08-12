import { Injectable, Logger } from '@nestjs/common';

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 3500;
const ALLOWED_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
]);

@Injectable()
export class GoogleAvatarService {
  private readonly logger = new Logger(GoogleAvatarService.name);

  private assertAllowedUrl(value: string) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
      throw new Error('Unsupported Google avatar host');
    }
    return url;
  }

  async fetchAvatar(picture?: string | null): Promise<Buffer | null> {
    if (!picture) return null;
    try {
      const initialUrl = this.assertAllowedUrl(picture);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(initialUrl, { redirect: 'manual', signal: controller.signal });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new Error('Missing redirect location');
          const redirected = this.assertAllowedUrl(new URL(location, initialUrl).toString());
          return this.readLimitedResponse(
            await fetch(redirected, { redirect: 'error', signal: controller.signal }),
          );
        }
        return this.readLimitedResponse(response);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      this.logger.warn(`Skipping Google avatar: ${(error as Error).message}`);
      return null;
    }
  }

  private async readLimitedResponse(response: Response) {
    if (!response.ok || !response.body) return null;
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BYTES) throw new Error('Avatar too large');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('Avatar too large');
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }
}
