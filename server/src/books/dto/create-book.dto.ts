import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty, IsArray, IsBoolean,
    IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength,
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
