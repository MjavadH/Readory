import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters.' })
  @MaxLength(20, { message: 'Username cannot exceed 20 characters.' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(128, { message: 'Password is too long.' })
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(128, { message: 'Password is too long.' })
  newPassword?: string;

  @IsOptional()
  @IsBoolean()
  showMemberSince?: boolean;

  @IsOptional()
  @IsBoolean()
  showFavorites?: boolean;

  @IsOptional()
  @IsBoolean()
  showRecentRatings?: boolean;

  @IsOptional()
  @IsBoolean()
  showRecentlyReading?: boolean;
}
