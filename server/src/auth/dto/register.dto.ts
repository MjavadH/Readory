import {IsEmail, IsNotEmpty, MinLength, Matches, MaxLength, IsString} from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'Please provide a valid email address.' })
    @Matches(/^[a-zA-Z0-9.]+@gmail\.com$/, {
        message: 'Email must be a valid Gmail address.',
    })
    email!: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(3, { message: 'Username must be at least 3 characters.' })
    @MaxLength(20, { message: 'Username cannot exceed 20 characters.' })
    @Matches(/^[a-zA-Z0-9_]+$/, {
        message: 'Username can only contain letters, numbers, and underscores.',
    })
    username!: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(8, {
        message: 'Password must be at least 8 characters long.',
    })
    @MaxLength(128, { message: 'Password is too long.' })
    password!: string;
}
