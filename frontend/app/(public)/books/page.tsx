import BooksClient from './BooksClient';
import { getInitialBooksData } from './books-api';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;

  const initialData = await getInitialBooksData(resolvedSearchParams);

  return <BooksClient initialData={initialData} />;
}
