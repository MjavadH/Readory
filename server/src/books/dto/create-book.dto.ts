import { Transform, Type } from 'class-transformer';
import { AgeRating, BookStatus, PublicationStatus } from '@readory/shared';
import { ContributorRole } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BookContributorDto {
  @IsInt()
  @Type(() => Number)
  contributorId!: number;

  @IsEnum(ContributorRole)
  role!: ContributorRole;
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
  @ValidateNested({ each: true })
  @Type(() => BookContributorDto)
  contributors?: BookContributorDto[];

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
  @IsEnum(PublicationStatus)
  publishStatus?: PublicationStatus;

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
