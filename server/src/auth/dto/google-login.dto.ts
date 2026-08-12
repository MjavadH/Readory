import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  credential!: string;
}
