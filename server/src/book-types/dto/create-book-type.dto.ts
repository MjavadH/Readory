import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBookTypeDto {
    @IsString()
    @MinLength(2)
    @MaxLength(60)
    name!: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(60)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case (a-z, 0-9, -)' })
    slug?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    iconKey?: string | null;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    sortOrder?: number;
}
