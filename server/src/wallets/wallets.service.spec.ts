import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let target: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletsService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
