import { Test, TestingModule } from '@nestjs/testing';
import { GenresService } from './genres.service';

describe('GenresService', () => {
  let target: GenresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenresService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<GenresService>(GenresService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
