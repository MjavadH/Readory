import { Transform, Type } from 'class-transformer';
import { AgeRating, BookStatus } from '@readory/shared';
import {
    ArrayNotEmpty, IsArray, IsBoolean,
    IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class CreateBookDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(200)
    title!: string;


    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @MaxLength(200)
    originalTitle?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(200, { each: true })
    alternativeTitles?: string[];

    @IsOptional()
    @IsEnum(BookStatus)
    status?: BookStatus;

    @IsOptional()
    @IsEnum(AgeRating)
    ageRating?: AgeRating;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1000)
    @Max(9999)
    publicationYear?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(200, { each: true })
    translators?: string[];

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @MaxLength(200)
    author?: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    description?: string;

    // Media.code (UUID v4)
    @IsOptional()
    @IsUUID('4')
    coverImage?: string;

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @Type(() => Number)
    @IsInt()
    @IsNotEmpty()
    @Min(1)
    typeId!: number;

    @IsArray()
    @ArrayNotEmpty()
    @Type(() => Number)
    @IsInt({ each: true })
    genreIds!: number[];
}
