import { Test, TestingModule } from '@nestjs/testing';
import { BookTypesController } from './book-types.controller';

describe('BookTypesController', () => {
  let controller: BookTypesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookTypesController],
    }).compile();

    controller = module.get<BookTypesController>(BookTypesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
