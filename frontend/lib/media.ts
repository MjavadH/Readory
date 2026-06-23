const S3_MEDIA_BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? ''
const PLACEHOLDER_IMAGE = '/placeholder.svg'

export const getBookCoverThumbnailKey = (code: string) =>
  `media/book-covers/${code}/thumbnail.webp`

export const getMediaUrl = (key?: string | null) => {
  if (!key) return PLACEHOLDER_IMAGE
  if (/^https?:\/\//i.test(key)) return key
  if (!S3_MEDIA_BASE_URL) return PLACEHOLDER_IMAGE
  return `${S3_MEDIA_BASE_URL}/${key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`
}

export const getBookCoverThumbnailUrl = (coverCode?: string | null) =>
  coverCode ? getMediaUrl(getBookCoverThumbnailKey(coverCode)) : PLACEHOLDER_IMAGE
