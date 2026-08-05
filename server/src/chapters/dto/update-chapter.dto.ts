import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PublicationStatus } from '@readory/shared';

export class UpdateChapterDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  index?: number;

  @IsOptional()
  @Matches(/^[0-9]+(?:\.[0-9]{1,2})?$/, {
    message: 'price must be a decimal string with up to 2 decimals',
  })
  price?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  contentPath?: string;

  @IsOptional()
  @IsEnum(PublicationStatus)
  publishStatus?: PublicationStatus;
}
