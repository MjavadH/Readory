import { BaseBrowseDto, TransformCsvToArray } from '../../books/dto/base-browse.dto';
import { IsOptional } from 'class-validator';

export class SearchQueryDto extends BaseBrowseDto {
  @IsOptional()
  @TransformCsvToArray()
  types?: string[];

  @IsOptional()
  @TransformCsvToArray()
  genres?: string[];
}
