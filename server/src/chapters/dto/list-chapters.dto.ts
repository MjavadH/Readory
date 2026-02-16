import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListChaptersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @Min(1)
  @Max(100)
  limit?: number;
}
