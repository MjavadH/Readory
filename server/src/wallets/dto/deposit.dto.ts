import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DepositDto {
    @IsNumber()
    @Min(0.01, { message: 'Amount must be at least 0.01' })
    @Max(1_000_000, { message: 'Amount exceeds the maximum allowed value' })
    amount!: number;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reference?: string;
}
