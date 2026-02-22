import { CacheSerializer } from './cache.serializer';

class Decimal {
    constructor(private readonly value: string) {}

    toString(): string {
        return this.value;
    }
}

describe('CacheSerializer', () => {
    it('handles BigInt, Decimal-like values, and Date', () => {
        const raw = {
            id: BigInt(42),
            price: new Decimal('19.99'),
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
        };

        const serialized = CacheSerializer.stringify(raw);
        const parsed = CacheSerializer.parse<{ id: bigint; price: string; createdAt: Date }>(serialized);

        expect(parsed.id).toBe(BigInt(42));
        expect(parsed.price).toBe('19.99');
        expect(parsed.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });
});
