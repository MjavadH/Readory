import { DomainEventType } from '@readory/shared';

export type BookPublishedEvent = {
  bookId: number;
  title: string;
  bookType: string;
  publishedAt: string;
};
export type ChapterPublishedEvent = {
  bookId: number;
  bookTitle: string;
  bookType: string;
  chapterId: number;
  chapterTitle: string;
  chapterIndex: number;
  publishedAt: string;
};
export type AdminBroadcastRequestedEvent = { broadcastId: string };

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
    };
