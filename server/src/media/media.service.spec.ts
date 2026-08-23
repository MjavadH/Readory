import { Test, type TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let target: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaService],
    })
      .useMocker(() => ({}))
      .compile();

    target = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });
});
