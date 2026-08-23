import type { PrismaService } from '../../prisma/prisma.service';

const delegateByTarget: Record<string, string> = {
  Book: 'book',
  Chapter: 'chapter',
  Genre: 'genre',
  Contributor: 'contributor',
  User: 'user',
  Staff: 'user',
  Media: 'media',
  BookType: 'bookType',
};
export function getTargetIdFromRequest(req: any): string | undefined {
  return req.params?.id ?? req.params?.chapterId ?? req.params?.bookId ?? req.body?.id;
}
export async function loadAuditTarget(
  prisma: PrismaService,
  targetType?: string,
  targetId?: string | number | null,
) {
  if (!targetType || targetId == null) return null;
  const delegateName =
    delegateByTarget[targetType] ?? targetType.charAt(0).toLowerCase() + targetType.slice(1);
  const delegate = (prisma as any)[delegateName];
  if (!delegate?.findUnique) return null;
  const numeric = Number(targetId);
  const id =
    Number.isInteger(numeric) && String(targetId).match(/^\d+$/) ? numeric : String(targetId);
  try {
    return await delegate.findUnique({ where: { id } });
  } catch {
    return null;
  }
}
export function targetName(value: any) {
  return value?.title ?? value?.name ?? value?.username ?? value?.email ?? value?.filename ?? null;
}
