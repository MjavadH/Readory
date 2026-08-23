import { Test, type TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller';

describe('WalletsController', () => {
  let target: WalletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<WalletsController>(WalletsController);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
