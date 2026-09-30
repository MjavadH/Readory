import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Breadcrumb, buildBreadcrumbJsonLd } from '@/components/breadcrumb';
import { ApiError, apiClient } from '@/lib/api-client';
import type { Collection } from '@/lib/collection-types';
import { getBookCoverThumbnailUrl } from '@/lib/media';
import { absoluteUrl } from '@/lib/seo';
import { buildCollectionJsonLd, jsonLdScript } from '@/lib/structured-data';
import { PublicCollectionView } from './PublicCollectionView';

const REVALIDATE_SECONDS = 120;

type PageProps = { params: Promise<{ slug: string }> };

/**
 * `cache()` dedupes the fetch between generateMetadata and the page within a single
 * request, so the API is hit once even though both need the collection.
 */
const getCollection = cache(async (slug: string): Promise<Collection | null> => {
  try {
    return await apiClient.get<Collection>(`/collections/${encodeURIComponent(slug)}`, {
      query: { limit: 48 },
      next: { revalidate: REVALIDATE_SECONDS, tags: ['collections', `collection:${slug}`] },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);

  // Missing/private collections must never be indexed.
  if (!collection) return { robots: { index: false, follow: false } };

  const description = collection.description?.trim() || undefined;
  const cover = collection.items.find((item) => item.book.coverImage)?.book.coverImage;
  const canonical = absoluteUrl(`/collections/${collection.slug}`);
  const coverUrl = cover ? absoluteUrl(getBookCoverThumbnailUrl(cover)) : undefined;

  return {
    title: collection.title,
    description,
    alternates: { canonical },
    // `indexable` is derived server-side (SYSTEM + PUBLIC). UNLISTED collections are
    // reachable by link but must stay out of search results.
    robots: collection.indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      title: collection.title,
      description,
      url: canonical,
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title: collection.title,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

export default async function PublicCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  // Structured data only for pages that are actually meant to be indexed.
  const jsonLd = collection.indexable ? buildCollectionJsonLd(collection) : null;
  const breadcrumbItems = [
    {
      label: 'Collections',
      href: '/collections',
      icon: <AppIcon name="collections" className="h-3.5 w-3.5" />,
    },
    { label: collection.title, href: `/collections/${collection.slug}` },
  ];
  const breadcrumbJsonLd = collection.indexable
    ? buildBreadcrumbJsonLd(breadcrumbItems, absoluteUrl)
    : null;

  return (
    <>
      {jsonLd ? (
        /** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      ) : null}
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          /** biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML */
          dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd)}
        />
      ) : null}
      <Breadcrumb items={breadcrumbItems} />
      <PublicCollectionView collection={collection} />
    </>
  );
}
