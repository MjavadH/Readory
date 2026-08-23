import { ArrayMaxSize, IsArray, IsOptional } from 'class-validator';
import { BaseBrowseDto, TransformCsvToArray } from '../../books/dto/base-browse.dto';

export class SearchQueryDto extends BaseBrowseDto {
  @IsOptional()
  @TransformCsvToArray()
  @ArrayMaxSize(10)
  types?: string[];

  @IsOptional()
  @TransformCsvToArray()
  @ArrayMaxSize(20)
  genres?: string[];

  @IsOptional()
  @TransformCsvToArray()
  @ArrayMaxSize(5)
  status?: string[];

  @IsOptional()
  @TransformCsvToArray()
  @ArrayMaxSize(5)
  ageRatings?: string[];
}
