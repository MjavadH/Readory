import {Transform, Type} from 'class-transformer';
import {IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength} from 'class-validator';

export class UpdateGenreDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(60)
    name?: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'slug must be lowercase and contain only letters, numbers, and hyphens',
    })
    @MaxLength(80)
    slug?: string;

    @Type(() => Boolean)
    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(999)
    featuredOrder?: number;
}
