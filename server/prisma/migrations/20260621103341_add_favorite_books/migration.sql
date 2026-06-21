-- CreateTable
CREATE TABLE "FavoriteBook" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteBook_userId_createdAt_idx" ON "FavoriteBook"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteBook_userId_bookId_key" ON "FavoriteBook"("userId", "bookId");

-- AddForeignKey
ALTER TABLE "FavoriteBook" ADD CONSTRAINT "FavoriteBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteBook" ADD CONSTRAINT "FavoriteBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
