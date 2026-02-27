import { Test, TestingModule } from '@nestjs/testing';
import { BookTypesService } from './book-types.service';

describe('BookTypesService', () => {
  let target: BookTypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookTypesService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<BookTypesService>(BookTypesService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
