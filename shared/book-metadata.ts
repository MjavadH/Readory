export enum BookStatus {
  Upcoming = 'UPCOMING',
  Ongoing = 'ONGOING',
  Completed = 'COMPLETED',
  Hiatus = 'HIATUS',
  Cancelled = 'CANCELLED',
}

export enum AgeRating {
  General = 'GENERAL',
  Teen = 'TEEN',
  Mature = 'MATURE',
  AdultsOnly = 'ADULTS_ONLY',
}

export const BOOK_STATUS_VALUES = Object.values(BookStatus);
export const AGE_RATING_VALUES = Object.values(AgeRating);
