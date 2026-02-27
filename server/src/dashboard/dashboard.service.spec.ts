import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let target: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
