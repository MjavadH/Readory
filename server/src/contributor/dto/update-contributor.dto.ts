import { PartialType } from '@nestjs/mapped-types';
import { CreateContributorDto } from './create-contributor.dto';

export class UpdateContributorDto extends PartialType(CreateContributorDto) {}
