export enum NotificationType {
  NEW_BOOK_PUBLISHED = 'content.book.published.v1',
  NEW_CHAPTER_PUBLISHED = 'content.chapter.published.v1',
  ADMIN_BROADCAST = 'admin.broadcast.v1',
  SYSTEM = 'system.notification.v1',
}

export enum DomainEventType {
  BOOK_PUBLISHED = 'book.published.v1',
  CHAPTER_PUBLISHED = 'chapter.published.v1',
  ADMIN_BROADCAST_REQUESTED = 'admin.broadcast.requested.v1',
  BOOK_UPDATED = 'book.updated.v1',
  BOOK_DELETED = 'book.deleted.v1',
}

export enum NotificationAudienceType {
  USER = 'USER',
  SELECTED_USERS = 'SELECTED_USERS',
  ALL_USERS = 'ALL_USERS',
}

export type NotificationApiItem = {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export type NotificationListResponse = {
  items: NotificationApiItem[];
  nextCursor: string | null;
};

export type UnreadCountResponse = { unreadCount: number };
