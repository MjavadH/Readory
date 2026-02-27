import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { BookTypesService } from '../book-types/book-types.service';
import { BooksService } from '../books/books.service';

describe('PublicController (http)', () => {
  let app: INestApplication;

  const publicServiceMock = {
    getHomeContent: jest.fn(),
    getGenresPage: jest.fn(),
  };

  const bookTypesServiceMock = {
    listPublic: jest.fn(),
    findByType: jest.fn(),
  };

  const booksServiceMock = {
    browseByGenre: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        { provide: PublicService, useValue: publicServiceMock },
        { provide: BookTypesService, useValue: bookTypesServiceMock },
        { provide: BooksService, useValue: booksServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /public/content returns response shape', async () => {
    publicServiceMock.getHomeContent.mockResolvedValue({ featured: [] });

    const res = await request(app.getHttpServer()).get('/public/content').expect(200);

    expect(res.body).toEqual({ featured: [] });
  });

  it('GET /public/book-types/:type returns 404 on missing type', async () => {
    bookTypesServiceMock.findByType.mockRejectedValue(new NotFoundException('book type not found'));

    await request(app.getHttpServer()).get('/public/book-types/unknown').expect(404);
  });
});
