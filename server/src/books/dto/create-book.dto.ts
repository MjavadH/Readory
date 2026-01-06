import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty, IsArray, IsBoolean,
    IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength,
} from 'class-validator';

export enum BookType {
    MANGA = 'MANGA',
    MANHWA = 'MANHWA',
    COMIC = 'COMIC',
    NOVEL = 'NOVEL',
    LIGHT_NOVEL = 'LIGHT_NOVEL',
}

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

    // Decimal string with up to 2 fractional digits
    @IsOptional()
    @Matches(/^[0-9]+(?:\.[0-9]{1,2})?$/, {
        message: 'price must be a decimal string with up to 2 decimal places',
    })
    price?: string;

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @IsOptional()
    @IsEnum(BookType, {
        message: 'Type must be one of: MANGA, MANHWA, COMIC, NOVEL, LIGHT_NOVEL',
    })
    type?: BookType;

    @IsArray()
    @ArrayNotEmpty()
    @Type(() => Number)
    @IsInt({ each: true })
    genreIds!: number[];
}
