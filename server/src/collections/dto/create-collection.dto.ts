import { CollectionVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RESERVED_SLUGS } from '../collections.constants';
import { trimString } from './transforms';

export class CreateCollectionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  title!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case (a-z, 0-9, -)' })
  @IsNotIn(RESERVED_SLUGS, { message: 'slug is reserved' })
  slug!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CollectionVisibility)
  visibility?: CollectionVisibility;
}
