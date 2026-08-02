import { BadRequestException } from '@nestjs/common';
import {
  compactMetadata,
  dedupeKey,
  sanitizeText,
  validateActionUrl,
} from './notification.utils';

describe('notification utilities', () => {
  it('creates stable dedupe keys', () => {
    expect(dedupeKey([1, 'event', 'type'])).toBe(
      dedupeKey([1, 'event', 'type']),
    );
    expect(dedupeKey([2, 'event', 'type'])).not.toBe(
      dedupeKey([1, 'event', 'type']),
    );
  });
  it('sanitizes bounded plain text', () => {
    expect(sanitizeText(' <b>Hello</b> ', 'title', 20)).toBe('bHello/b');
    expect(() => sanitizeText('', 'title', 20)).toThrow(BadRequestException);
  });
  it('allows only internal action URLs', () => {
    expect(validateActionUrl('/books/1?chapter=2')).toBe('/books/1?chapter=2');
    expect(() => validateActionUrl('https://evil.test')).toThrow(
      BadRequestException,
    );
  });
  it('keeps metadata bounded and scalar', () => {
    expect(
      compactMetadata({ bookId: 1, ok: true, nested: { no: true } }),
    ).toEqual({ bookId: 1, ok: true });
  });
});
