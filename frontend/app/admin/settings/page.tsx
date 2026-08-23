'use client';

import { BookSearchIcon, DatabaseZap, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';

export default function SettingsPage() {
  const t = useTranslations('AdminPage.Settings');
  const toast = useToast();

  const [isSyncBooks, setIsSyncBooks] = useState(false);
  const [isSyncChapterCounts, setIsSyncChapterCounts] = useState(false);

  const syncAllBooks = async () => {
    try {
      setIsSyncBooks(true);

      await apiClient.post('/search/admin/sync-all');

      toast.success(t('SyncAllBooksSuccess'));
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setIsSyncBooks(false);
    }
  };

  const syncBookChapterCounts = async () => {
    try {
      setIsSyncChapterCounts(true);

      await apiClient.post('/admin/maintenance/sync-book-chapter-counts');

      toast.success(t('SyncBookChapterCountsSuccess'));
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setIsSyncChapterCounts(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <AdminPageHeader icon={Settings} title={t('Title')} description={t('Description')} />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            onClick={syncAllBooks}
            disabled={isSyncBooks || isSyncChapterCounts}
            className="mt-6"
          >
            <BookSearchIcon className="me-2 h-4 w-4" />
            {isSyncBooks ? t('SyncAllBooksLoading') : t('SyncAllBooks')}
          </Button>

          <Button
            variant="outline"
            onClick={syncBookChapterCounts}
            disabled={isSyncBooks || isSyncChapterCounts}
            className="mt-6"
          >
            <DatabaseZap className="me-2 h-4 w-4" />
            {isSyncChapterCounts ? t('SyncBookChapterCountsLoading') : t('SyncBookChapterCounts')}
          </Button>
        </div>
      </div>
    </div>
  );
}
