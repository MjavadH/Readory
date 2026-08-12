import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkGoogleDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  credential!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(256)
  nonce!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
