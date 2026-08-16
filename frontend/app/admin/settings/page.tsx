'use client';

import { BookSearchIcon, Settings } from 'lucide-react';
import AdminPageHeader from '@/components/admin/admin-page-header';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const t = useTranslations('AdminPage.Settings');
  const toast = useToast();

  const [isSyncBooks, setIsSyncBooks] = useState(false);

  const syncAllBooks = async () => {
    try {
      setIsSyncBooks(true);
      const data = await apiClient.post(`/search/admin/sync-all`);
      toast.success('success');
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getApiErrorMessage(err));
      }
    } finally {
      setIsSyncBooks(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <AdminPageHeader icon={Settings} title={t('Title')} description={t('Description')} />

        <Button onClick={syncAllBooks} disabled={isSyncBooks} className="mt-6">
          <BookSearchIcon className="me-2 h-4 w-4" />
          {t('SyncAllBooks')}
        </Button>
      </div>
    </div>
  );
}
