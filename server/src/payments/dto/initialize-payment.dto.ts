import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class InitializePaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MaxLength(50)
  provider!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
