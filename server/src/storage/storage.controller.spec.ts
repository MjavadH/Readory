import { Test, type TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';

describe('StorageController', () => {
  let target: StorageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<StorageController>(StorageController);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
