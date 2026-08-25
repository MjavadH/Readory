'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { BookCard } from '@/components/book-card';
import { CollectionsGrid } from '@/components/collections/collections-grid';
import { ProfileError } from '@/components/profile/profile-error';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileSection } from '@/components/profile/profile-section';
import { ProfileSkeleton } from '@/components/profile/profile-skeleton';
import { RatingCard } from '@/components/profile/rating-card';
import { ReadingCard } from '@/components/profile/reading-card';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { type PublicProfile, toCollectionSummary } from '@/lib/public-profile';

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? '';
  const t = useTranslations('PublicProfile');

  const profileUrl = username ? `/public/profiles/${encodeURIComponent(username)}` : null;
  const { data, error, isLoading, mutate } = useSWR<PublicProfile>(
    profileUrl,
    (url: string) => apiClient.get<PublicProfile>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  if (isLoading) return <ProfileSkeleton />;

  if (!username) return <ProfileError variant="notFound" />;

  if (error) {
    const status =
      (error as { status?: number; statusCode?: number })?.status ??
      (error as { statusCode?: number })?.statusCode;

    if (status === 404) return <ProfileError variant="notFound" />;

    return (
      <ProfileError
        variant="error"
        message={getApiErrorMessage(error, t('LoadFailed'))}
        onRetry={() => void mutate()}
      />
    );
  }

  if (!data?.user) return <ProfileError variant="notFound" />;

  const { user, sections } = data;
  const collections = sections.collections ?? [];
  const favorites = sections.favoriteBooks;
  const ratings = sections.recentRatings;
  const reading = sections.recentlyReading;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-5 sm:space-y-10 sm:px-6 sm:py-7 lg:px-8">
      <ProfileHeader
        username={user.username}
        avatarKey={user.avatarKey ?? null}
        memberSince={user.memberSince ?? null}
      />

      {collections.length > 0 ? (
        <ProfileSection title={t('Collections')}>
          <CollectionsGrid
            collections={collections.map((collection) => toCollectionSummary(collection, user.id))}
            hrefPrefix={`/u/${user.username}/collections`}
          />
        </ProfileSection>
      ) : null}

      {favorites ? (
        <ProfileSection
          title={t('Favorites')}
          emptyLabel={t('NoFavorites')}
          isEmpty={favorites.length === 0}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.map((book, index) => (
              <BookCard key={book.id} book={book} priority={index < 3} />
            ))}
          </div>
        </ProfileSection>
      ) : null}

      {ratings ? (
        <ProfileSection
          title={t('RecentRatings')}
          emptyLabel={t('NoRatings')}
          isEmpty={ratings.length === 0}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ratings.map((item, index) => (
              <RatingCard
                key={`${item.book.id}-${item.ratedAt}`}
                book={item.book}
                rating={item.rating}
                ratedAt={item.ratedAt}
                index={index}
              />
            ))}
          </div>
        </ProfileSection>
      ) : null}

      {reading ? (
        <ProfileSection
          title={t('RecentlyReading')}
          emptyLabel={t('NoReading')}
          isEmpty={reading.length === 0}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reading.map((item, index) => (
              <ReadingCard
                key={`${item.book.id}-${item.lastReadAt}`}
                book={item.book}
                percent={item.percent}
                lastReadAt={item.lastReadAt}
                index={index}
              />
            ))}
          </div>
        </ProfileSection>
      ) : null}
    </main>
  );
}
