// base-browse.dto.ts
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type BrowseSort = 'newest' | 'oldest' | 'most_popular' | 'recently_updated' | 'trend';

// Parse comma-separated strings into a sanitized array.
export function TransformCsvToArray() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return [];
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  });
}

export class BaseBrowseDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'most_popular', 'recently_updated', 'trend'])
  sort?: BrowseSort;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
