import { Type } from 'class-transformer';
import {ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, MaxLength, Min} from 'class-validator';

export class AddCollectionItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateCollectionItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReorderCollectionItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  itemIds!: number[];
}
