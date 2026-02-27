import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@readory/shared', () => ({
  ICON_KEYS: ['book-open'],
}), { virtual: true });

import { GenresController } from './genres.controller';

describe('GenresController', () => {
  let controller: GenresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenresController],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<GenresController>(GenresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
