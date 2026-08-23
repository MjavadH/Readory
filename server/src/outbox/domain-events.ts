import type { DomainEventType } from '@readory/shared';

export type BookPublishedEvent = {
  bookId: number;
  title: string;
  bookType: string;
  coverImage?: string | null;
  publishedAt: string;
};
export type ChapterPublishedEvent = {
  bookId: number;
  bookTitle: string;
  bookType: string;
  coverImage?: string | null;
  chapterId: number;
  chapterTitle: string;
  chapterIndex: number;
  publishedAt: string;
};
export type AdminBroadcastRequestedEvent = { broadcastId: string };

export type BookUpdatedEvent = {
  bookId: number;
  title: string;
  bookType: string;
  genres: string[];
  status: string;
  trendScore: number;
  popularityScore: number;
  coverImage?: string | null;
  updatedAt: string;
};

export type BookDeletedEvent = {
  bookId: number;
};

export type DomainEvent =
  | {
      type: DomainEventType.BOOK_PUBLISHED;
      version: 1;
      aggregateType: 'Book';
      aggregateId: string;
      payload: BookPublishedEvent;
    }
  | {
      type: DomainEventType.CHAPTER_PUBLISHED;
      version: 1;
      aggregateType: 'Chapter';
      aggregateId: string;
      payload: ChapterPublishedEvent;
    }
  | {
      type: DomainEventType.ADMIN_BROADCAST_REQUESTED;
      version: 1;
      aggregateType: 'NotificationBroadcast';
      aggregateId: string;
      payload: AdminBroadcastRequestedEvent;
    }
  | {
      type: DomainEventType.BOOK_UPDATED;
      version: 1;
      aggregateType: 'Book';
      aggregateId: string;
      payload: BookUpdatedEvent;
    }
  | {
      type: DomainEventType.BOOK_DELETED;
      version: 1;
      aggregateType: 'Book';
      aggregateId: string;
      payload: BookDeletedEvent;
    };
