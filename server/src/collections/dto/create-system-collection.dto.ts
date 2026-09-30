import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCollectionDto } from './create-collection.dto';

export class CreateSystemCollectionDto extends CreateCollectionDto {
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
