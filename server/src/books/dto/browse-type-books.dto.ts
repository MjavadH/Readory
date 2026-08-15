import { IsOptional } from 'class-validator';
import { BaseBrowseDto, TransformCsvToArray } from './base-browse.dto';

export class BrowseTypeBooksDto extends BaseBrowseDto {
  @IsOptional()
  @TransformCsvToArray()
  genres?: string[];
}
