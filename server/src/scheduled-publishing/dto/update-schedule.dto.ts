import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateScheduleDto {
  @IsDateString()
  publishAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  maxRetries?: number;
}
