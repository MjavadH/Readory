import { CanActivate, ExecutionContext, INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

class AllowGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: 1, id: 1 };
    return true;
  }
}

describe('BooksController (http)', () => {
  let app: INestApplication;

  const booksServiceMock = {
    browse: jest.fn(),
    findById: jest.fn(),
    listAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: booksServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(AllowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /books/browse returns response shape', async () => {
    booksServiceMock.browse.mockResolvedValue({ items: [{ id: 1 }], nextCursor: null, hasMore: false });

    const res = await request(app.getHttpServer()).get('/books/browse').expect(200);

    expect(res.body).toEqual({ items: [{ id: 1 }], nextCursor: null, hasMore: false });
  });

  it('GET /books/:id returns 404 for missing book', async () => {
    booksServiceMock.findById.mockRejectedValue(new NotFoundException('book not found'));

    await request(app.getHttpServer()).get('/books/999').expect(404);
  });
});
