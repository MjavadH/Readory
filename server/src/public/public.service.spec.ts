import { Test, TestingModule } from '@nestjs/testing';
import { PublicService } from './public.service';

describe('PublicService', () => {
  let target: PublicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<PublicService>(PublicService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
