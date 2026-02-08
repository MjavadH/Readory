import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type BrowseSort =
    | 'newest'
    | 'oldest'
    | 'most_popular'
    | 'recently_updated';

const splitCsv = (v: unknown): string[] => {
    if (typeof v !== 'string') return [];
    return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
};

export class BrowseBooksDto {
    @IsOptional()
    @Transform(({ value }) => splitCsv(value))
    types?: string[]; // BookType enum values

    @IsOptional()
    @Transform(({ value }) => splitCsv(value))
    genres?: string[]; // genre slugs

    @IsOptional()
    @IsString()
    q?: string; // title or author

    @IsOptional()
    @IsIn(['newest', 'oldest', 'most_popular', 'recently_updated'])
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