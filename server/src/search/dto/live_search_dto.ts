import { IsString, MaxLength, MinLength } from 'class-validator';

export class LiveSearchDto {
  @IsString()
  @MaxLength(100, { message: 'query is too long.' })
  @MinLength(2, { message: 'query must be at least 2 characters long.' })
  q!: string;
}
