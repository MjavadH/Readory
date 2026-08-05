import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits.' })
  otp!: string;
}
