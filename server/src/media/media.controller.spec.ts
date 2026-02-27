import { Test, TestingModule } from '@nestjs/testing';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock(
  'file-type',
  () => ({
    fileTypeFromBuffer: jest.fn(),
  }),
  { virtual: true },
);

import { MediaController } from './media.controller';

describe('MediaController', () => {
  let controller: MediaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<MediaController>(MediaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
