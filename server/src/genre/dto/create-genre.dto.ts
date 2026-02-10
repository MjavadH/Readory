import {Transform, Type} from 'class-transformer';
import {
    IsBoolean, IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength
} from 'class-validator';
import { ICON_KEYS, type IconKey } from "@readory/shared";

export class CreateGenreDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(60)
    @Matches(/^[a-zA-Z0-9\s\-_'&]+$/, {
        message: 'Name contains invalid characters',
    })
    name!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'slug must be lowercase and contain only letters, numbers, and hyphens',
    })
    @MaxLength(80)
    slug?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    @IsIn(ICON_KEYS, { message: "iconKey is invalid" })
    iconKey?: IconKey;

    @Type(() => Boolean)
    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(999)
    featuredOrder?: number;
}
