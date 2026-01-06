import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateChapterDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title!: string;

    @IsInt()
    @Min(1)
    index!: number;

    @IsOptional()
    @Matches(/^[0-9]+(?:\.[0-9]{1,2})?$/, { message: 'price must be a decimal string with up to 2 decimals' })
    price?: string;

    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @IsOptional()
    @IsBoolean()
    requiresSeparatePurchase?: boolean;

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @MaxLength(500)
    contentPath?: string;
}
