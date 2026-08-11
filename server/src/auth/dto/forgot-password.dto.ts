import { IsEmail, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @Matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/, {
    message: 'Email must be a valid Gmail address.',
  })
  email!: string;
}
