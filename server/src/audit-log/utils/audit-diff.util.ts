import { AuditDiffEntry } from '../interfaces/audit-log.interface';

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
const formatLabel = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const stable = (value: unknown) => JSON.stringify(value, Object.keys((isObject(value) ? value : {}) as object).sort());
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

export function generateAuditDiff(before: unknown, after: unknown, path = ''): AuditDiffEntry[] {
  if (same(before, after)) return [];
  if (Array.isArray(before) || Array.isArray(after)) {
    const beforeArray = Array.isArray(before) ? before : [];
    const afterArray = Array.isArray(after) ? after : [];
    const entries: AuditDiffEntry[] = [];
    beforeArray.forEach((item, index) => { if (!afterArray.some((candidate) => same(candidate, item))) entries.push({ path: `${path}[${index}]`, label: `${formatLabel(path || 'Item')} ${index + 1}`, type: 'removed', before: item }); });
    afterArray.forEach((item, index) => { if (!beforeArray.some((candidate) => same(candidate, item))) entries.push({ path: `${path}[${index}]`, label: `${formatLabel(path || 'Item')} ${index + 1}`, type: 'added', after: item }); });
    if (!entries.length) entries.push({ path, label: formatLabel(path || 'Array'), type: 'modified', before, after });
    return entries;
  }
  if (isObject(before) || isObject(after)) {
    const keys = new Set([...Object.keys((before as Record<string, unknown>) ?? {}), ...Object.keys((after as Record<string, unknown>) ?? {})]);
    return [...keys].flatMap((key): AuditDiffEntry[] => {
      const childPath = path ? `${path}.${key}` : key;
      const childBefore = isObject(before) ? before[key] : undefined;
      const childAfter = isObject(after) ? after[key] : undefined;
      if (same(childBefore, childAfter)) return [];
      if (isObject(childBefore) || isObject(childAfter) || Array.isArray(childBefore) || Array.isArray(childAfter)) {
        const children = generateAuditDiff(childBefore, childAfter, childPath);
        return [{ path: childPath, label: formatLabel(key), type: 'modified' as const, children, collapsed: children.length > 12 }];
      }
      return [{ path: childPath, label: formatLabel(key), type: childBefore === undefined ? 'added' : childAfter === undefined ? 'removed' : 'modified', before: childBefore, after: childAfter }];
    });
  }
  return [{ path, label: formatLabel(path || 'Value'), type: before === undefined ? 'added' : after === undefined ? 'removed' : 'modified', before, after }];
}
