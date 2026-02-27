import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findUserByIdentifier: jest.fn(),
    verifyAndCreateUser: jest.fn(),
    findById: jest.fn(),
    registerTemporaryUser: jest.fn(),
    updateLastLogin: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(usersService, jwtService);
  });

  it('login returns token and safe profile', async () => {
    usersService.findById.mockResolvedValue({
      id: 5,
      email: 'user@example.com',
      username: 'user',
      isBanned: false,
      permissions: ['MANAGE_BOOKS'],
      role: { name: 'ADMIN' },
      wallet: { balance: '12.50' },
    } as never);
    jwtService.signAsync.mockResolvedValue('jwt-token' as never);

    const result = await service.login({ id: 5 });

    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(usersService.updateLastLogin).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      access_token: 'jwt-token',
      user: {
        id: 5,
        userId: 5,
        email: 'user@example.com',
        username: 'user',
        walletBalance: 12.5,
        roleName: 'ADMIN',
        permissions: ['MANAGE_BOOKS'],
      },
    });
  });

  it('getProfile throws for banned users', async () => {
    usersService.findById.mockResolvedValue({
      id: 2,
      email: 'banned@example.com',
      username: 'banned',
      isBanned: true,
      permissions: [],
      role: { name: 'USER' },
      wallet: { balance: 0 },
    } as never);

    await expect(service.getProfile(2)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
