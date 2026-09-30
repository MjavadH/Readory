'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

export async function revalidateCollections(slug?: string): Promise<void> {
  revalidateTag('collections', { expire: 0 });
  if (slug) revalidateTag(`collection:${slug}`, { expire: 0 });
  revalidatePath('/collections');
  if (slug) revalidatePath(`/collections/${slug}`);
}
