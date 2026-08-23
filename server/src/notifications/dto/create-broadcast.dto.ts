import { NotificationAudienceType } from '@readory/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBroadcastDto {
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(1000) body!: string;
  @IsOptional() @IsString() @MaxLength(512) actionUrl?: string;
  @IsEnum(NotificationAudienceType) audienceType!: NotificationAudienceType;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  targetUserIds?: number[];
  @IsOptional() @IsISO8601() expiresAt?: string;
  @IsOptional() metadata?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(128) idempotencyKey?: string;
}
