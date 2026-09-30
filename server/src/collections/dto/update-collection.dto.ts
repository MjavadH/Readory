import { PartialType } from '@nestjs/mapped-types';
import { CreateSystemCollectionDto } from './create-system-collection.dto';

export class UpdateCollectionDto extends PartialType(CreateSystemCollectionDto) {}
