import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { S3Client } from '@aws-sdk/client-s3';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {PublicationStatus} from "@readory/shared";

describe('AppModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const redisStore = new Map<string, string>();
  const redisMock = {
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (redisStore.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    incr: jest.fn(async (key: string) => {
      const current = Number(redisStore.get(key) ?? '0') + 1;
      redisStore.set(key, String(current));
      return current;
    }),
    expire: jest.fn(async () => 1),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisMock)
      .overrideProvider(S3Client)
      .useValue({ send: jest.fn().mockResolvedValue({}) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  beforeEach(() => {
    redisStore.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /public/content returns 200 and expected shape with seeded data', async () => {
    const type = await prisma.bookType.create({
      data: {
        name: 'Manga',
        slug: 'manga',
        isActive: true,
      },
    });

    await prisma.book.create({
      data: {
        title: 'E2E Book',
        typeId: type.id,
        publishStatus: PublicationStatus.PUBLISHED,
        isFeatured: true,
      },
    });

    const res = await request(app.getHttpServer()).get('/public/content').expect(200);

    expect(res.body).toMatchObject({
      hero: expect.any(Array),
      latest: expect.any(Array),
      trending: expect.any(Array),
      genres: expect.any(Array),
    });
  });

  it('GET /auth/profile returns 401 without token and 200 with signed JWT cookie', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'e2e-user@example.com',
        username: 'e2e-user',
        passwordHash: 'not-used-in-this-test',
      },
    });

    await request(app.getHttpServer()).get('/auth/profile').expect(401);

    const token = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    const res = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Cookie', [`access_token=${token}`])
      .expect(200);

    expect(res.body).toMatchObject({
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username,
    });
  });
});
