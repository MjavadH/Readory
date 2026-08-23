import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

class AllowLocalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 5, userId: 5 };
    return true;
  }
}

class AllowJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: 5 };
    return true;
  }
}

describe('AuthController (http)', () => {
  let app: INestApplication;

  const authServiceMock = {
    login: jest.fn(),
    register: jest.fn(),
    verifyEmail: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(LocalAuthGuard)
      .useClass(AllowLocalGuard)
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/register returns response shape', async () => {
    authServiceMock.register.mockResolvedValue({ message: 'registered' });

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'u@test.com', username: 'u', password: 'password123' })
      .expect(201);

    expect(res.body).toEqual({ message: 'registered' });
  });

  it('GET /auth/profile returns 401 on service error', async () => {
    authServiceMock.getProfile.mockRejectedValue(new UnauthorizedException('denied'));

    await request(app.getHttpServer()).get('/auth/profile').expect(401);
  });
});
