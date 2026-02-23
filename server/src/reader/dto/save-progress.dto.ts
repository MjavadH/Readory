import { IsInt, Min } from 'class-validator';

export class SaveProgressDto {
  @IsInt()
  @Min(1)
  chapterId!: number;

  @IsInt()
  @Min(1)
  lastPage!: number;
}
