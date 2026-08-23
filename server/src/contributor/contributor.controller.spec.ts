import { Test, type TestingModule } from '@nestjs/testing';
import { ContributorController } from './contributor.controller';
import { ContributorService } from './contributor.service';

describe('ContributorController', () => {
  let controller: ContributorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContributorController],
      providers: [ContributorService],
    }).compile();

    controller = module.get<ContributorController>(ContributorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
