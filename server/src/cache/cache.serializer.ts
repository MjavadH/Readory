const BIGINT_TAG = '__cache_bigint__';
const DATE_TAG = '__cache_date__';
const DECIMAL_TAG = '__cache_decimal__';

function isDecimalLike(value: unknown): value is { toString(): string } {
    return Boolean(
        value &&
            typeof value === 'object' &&
            typeof (value as { toString?: unknown }).toString === 'function' &&
            (value as { constructor?: { name?: string } }).constructor?.name === 'Decimal',
    );
}

export class CacheSerializer {
    static stringify<T>(value: T): string {
        return JSON.stringify(value, function (key, currentValue) {
            const sourceValue = key ? (this as Record<string, unknown>)[key] : currentValue;

            if (typeof currentValue === 'bigint') {
                return { [BIGINT_TAG]: currentValue.toString() };
            }

            if (sourceValue instanceof Date) {
                return { [DATE_TAG]: sourceValue.toISOString() };
            }

            if (isDecimalLike(currentValue)) {
                return { [DECIMAL_TAG]: currentValue.toString() };
            }

            return currentValue;
        });
    }

    static parse<T>(raw: string): T {
        return JSON.parse(raw, (_key, currentValue) => {
            if (currentValue && typeof currentValue === 'object') {
                if (BIGINT_TAG in currentValue) {
                    return BigInt(currentValue[BIGINT_TAG]);
                }

                if (DATE_TAG in currentValue) {
                    return new Date(currentValue[DATE_TAG]);
                }

                if (DECIMAL_TAG in currentValue) {
                    return currentValue[DECIMAL_TAG];
                }
            }

            return currentValue;
        }) as T;
    }
}
