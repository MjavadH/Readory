import { Test, TestingModule } from '@nestjs/testing';
import { ChaptersController } from './chapters.controller';

describe('ChaptersController', () => {
  let target: ChaptersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChaptersController],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<ChaptersController>(ChaptersController);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
