import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_REORDER_ITEMS } from '../collections.constants';
import { trimString } from './transforms';

export class AddCollectionItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId!: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateCollectionItemDto {
  /** Empty string or null clears the note. */
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class ReorderCollectionItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_REORDER_ITEMS)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  itemIds!: number[];
}
