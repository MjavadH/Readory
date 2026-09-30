'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CollectionDetail } from '@/components/collections/collection-detail';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { Collection } from '@/lib/collection-types';
import { revalidateCollections } from './revalidate-collections';

export function PublicCollectionView({ collection }: { collection: Collection }) {
  const router = useRouter();
  const { user } = useCurrentUser();

  // `GET /collections/:slug` only returns PUBLIC/UNLISTED SYSTEM collections, so there is
  // no owner on this route: only an admin can edit or add books.
  const isAdmin = user?.roleName === 'ADMIN';

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <CollectionDetail
        collection={collection}
        canEdit={isAdmin}
        canAddItems={isAdmin}
        onChanged={async () => {
          await revalidateCollections(collection.slug);
          router.refresh();
        }}
        onDeleted={async () => {
          await revalidateCollections(collection.slug);
          router.replace('/collections');
        }}
      />
    </motion.main>
  );
}
