import { IsOptional } from 'class-validator';
import { BaseBrowseDto, TransformCsvToArray } from './base-browse.dto';

export class BrowseBooksDto extends BaseBrowseDto {
  @IsOptional()
  @TransformCsvToArray()
  types?: string[];

  @IsOptional()
  @TransformCsvToArray()
  genres?: string[];
}
