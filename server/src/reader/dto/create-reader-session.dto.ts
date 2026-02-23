import { IsInt, Min } from 'class-validator';

export class CreateReaderSessionDto {
  @IsInt()
  @Min(1)
  bookId!: number;

  @IsInt()
  @Min(1)
  chapterIndex!: number;
}
