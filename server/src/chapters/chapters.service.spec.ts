import { Test, TestingModule } from '@nestjs/testing';
import { ChaptersService } from './chapters.service';

describe('ChaptersService', () => {
  let target: ChaptersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChaptersService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<ChaptersService>(ChaptersService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
