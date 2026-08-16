import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
  @MaxLength(100)
  @MinLength(2)
  q?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'most_popular', 'recently_updated', 'trend'])
  sort?: BrowseSort;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @Min(1)
  @Max(30)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}
