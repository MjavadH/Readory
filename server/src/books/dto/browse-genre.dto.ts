import { IsOptional } from 'class-validator';
import { BaseBrowseDto, TransformCsvToArray } from './base-browse.dto';

export class BrowseGenreDto extends BaseBrowseDto {
  @IsOptional()
  @TransformCsvToArray()
  types?: string[];
}
