-- Add and populate a temporary nullable column before enforcing constraints.
ALTER TABLE "Book" ADD COLUMN "slug" TEXT;

-- The id suffix makes every generated fallback slug deterministic and unique.
UPDATE "Book"
SET "slug" = CONCAT(
  COALESCE(
    NULLIF(
      TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("title"), '[^[:alnum:]]+', '-', 'g')),
      ''
    ),
    'book'
  ),
  '-',
  "id"
);

ALTER TABLE "Book" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");
