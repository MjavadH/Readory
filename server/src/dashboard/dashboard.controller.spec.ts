import { Test, type TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  let target: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
