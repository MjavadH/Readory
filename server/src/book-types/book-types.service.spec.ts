import { Test, TestingModule } from '@nestjs/testing';
import { BookTypesService } from './book-types.service';

describe('BookTypesService', () => {
  let service: BookTypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookTypesService],
    }).compile();

    service = module.get<BookTypesService>(BookTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
