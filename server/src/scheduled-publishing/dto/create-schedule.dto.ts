import { ScheduledTargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsEnum(ScheduledTargetType)
  targetType!: ScheduledTargetType;

  @Type(() => Number)
  @IsInt()
  targetId!: number;

  @IsDateString()
  publishAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  maxRetries?: number;
}
