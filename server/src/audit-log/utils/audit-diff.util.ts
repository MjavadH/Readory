import { AuditDiffEntry } from '../interfaces/audit-log.interface';

const IGNORED_KEYS = [
  /^updatedAt$/i,
  /^createdAt$/i,
  /^deletedAt$/i,
  /timestamp/i,
  /^_*cache/i,
  /computed/i,
  /^version$/i,
  /Version$/,
];
const isIgnored = (key: string) => IGNORED_KEYS.some((pattern) => pattern.test(key));
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
const label = (key: string) =>
  key
    .split('.')
    .pop()!
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
const normalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (isObject(value))
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        if (!isIgnored(key)) acc[key] = normalize(value[key]);
        return acc;
      }, {});
  return value;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
const comparableKey = (item: unknown) =>
  isObject(item) && item.id != null ? String(item.id) : JSON.stringify(normalize(item));
const arrayKey = (item: unknown, seen: Map<string, number>) => {
  const key = comparableKey(item);
  const count = seen.get(key) ?? 0;
  seen.set(key, count + 1);
  return `${key}:${count}`;
};

export function generateAuditDiff(before: unknown, after: unknown, path = ''): AuditDiffEntry[] {
  if (same(before, after)) return [];
  if (Array.isArray(before) || Array.isArray(after)) {
    const prev = Array.isArray(before) ? before : [];
    const next = Array.isArray(after) ? after : [];
    const entries: AuditDiffEntry[] = [];
    const prevSeen = new Map<string, number>();
    const nextSeen = new Map<string, number>();
    const prevMap = new Map(prev.map((item, index) => [arrayKey(item, prevSeen), { item, index }]));
    const nextMap = new Map(next.map((item, index) => [arrayKey(item, nextSeen), { item, index }]));
    for (const [key, value] of prevMap) {
      const nextValue = nextMap.get(key);
      if (!nextValue)
        entries.push({
          path: `${path}[${value.index}]`,
          label: `${label(path || 'Item')} ${value.index + 1}`,
          type: 'removed',
          before: value.item,
          after: null,
        });
      else if (!same(value.item, nextValue.item))
        entries.push({
          path: `${path}[${value.index}]`,
          label: `${label(path || 'Item')} ${value.index + 1}`,
          type: 'modified',
          before: value.item,
          after: nextValue.item,
          children: generateAuditDiff(value.item, nextValue.item, `${path}[${value.index}]`),
        });
    }
    for (const [key, value] of nextMap)
      if (!prevMap.has(key))
        entries.push({
          path: `${path}[${value.index}]`,
          label: `${label(path || 'Item')} ${value.index + 1}`,
          type: 'added',
          before: null,
          after: value.item,
        });
    return entries;
  }
  if (isObject(before) || isObject(after)) {
    const prev = isObject(before) ? before : {};
    const next = isObject(after) ? after : {};
    return Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]))
      .filter((key) => !isIgnored(key))
      .flatMap((key) => {
        const childPath = path ? `${path}.${key}` : key;
        const childBefore = prev[key];
        const childAfter = next[key];
        if (same(childBefore, childAfter)) return [];
        if (
          isObject(childBefore) ||
          isObject(childAfter) ||
          Array.isArray(childBefore) ||
          Array.isArray(childAfter)
        ) {
          const children = generateAuditDiff(childBefore, childAfter, childPath);
          if (isObject(childBefore) || isObject(childAfter)) return children;
          return [
            {
              path: childPath,
              label: label(key),
              type:
                childBefore === undefined
                  ? ('added' as const)
                  : childAfter === undefined
                    ? ('removed' as const)
                    : ('modified' as const),
              before: childBefore ?? null,
              after: childAfter ?? null,
              children,
              collapsed: children.length > 8,
            },
          ];
        }
        return [
          {
            path: childPath,
            label: label(key),
            type:
              childBefore === undefined
                ? ('added' as const)
                : childAfter === undefined
                  ? ('removed' as const)
                  : ('modified' as const),
            before: childBefore ?? null,
            after: childAfter ?? null,
          },
        ];
      });
  }
  return [
    {
      path,
      label: label(path || 'Value'),
      type: before === undefined ? 'added' : after === undefined ? 'removed' : 'modified',
      before: before ?? null,
      after: after ?? null,
    },
  ];
}
