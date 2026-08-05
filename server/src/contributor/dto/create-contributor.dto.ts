import { IsString, IsOptional, IsNotEmpty, MaxLength, Matches, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeSlug } from '../../common';
import { ContributorGender } from '@readory/shared';

export class CreateContributorDto {
  @IsString({ message: "The contributor's name must be a text string." })
  @IsNotEmpty({ message: "The contributor's name is required." })
  @MaxLength(255, { message: "The contributor's name cannot exceed 255 characters." })
  name!: string;

  @IsString({ message: 'The original name must be a text string.' })
  @IsOptional()
  @MaxLength(255)
  originalName?: string;

  @IsString({ message: 'The slug must be a text string.' })
  @IsNotEmpty({ message: 'The slug is required.' })
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase and contain only letters, numbers, and hyphens',
  })
  @Transform(({ value }) => (value ? normalizeSlug(value) : value))
  slug!: string;

  @IsString({ message: 'The biography must be a text string.' })
  @IsOptional()
  biography?: string;

  @IsEnum(ContributorGender, { message: 'The entered gender is invalid.' })
  @IsOptional()
  gender?: ContributorGender;
}
