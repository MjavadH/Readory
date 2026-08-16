import { registerAs } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';

export default registerAs('meilisearch', () => {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_API_KEY;

  if (!host) {
    throw new Error('MEILISEARCH_HOST is not configured');
  }
  if (!apiKey) {
    throw new Error('MEILISEARCH_API_KEY is not configured');
  }

  return new Meilisearch({
    host,
    apiKey,
  });
});
