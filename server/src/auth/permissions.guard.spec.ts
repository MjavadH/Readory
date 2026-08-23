import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { AdminPermissions } from './permissions.enum';
import { PermissionsGuard } from './permissions.guard';

const executionContext = (user?: unknown) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
  const config = { get: jest.fn() } as unknown as jest.Mocked<ConfigService>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsGuard(reflector, config);
    config.get.mockReturnValue(1 as never);
  });

  it('allows routes with no permission metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(executionContext())).toBe(true);
  });

  it('allows the configured super admin even without explicit permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminPermissions.MANAGE_BOOKS]);

    expect(guard.canActivate(executionContext({ userId: 1, permissions: [] }))).toBe(true);
  });

  it('allows users with at least one required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminPermissions.MANAGE_BOOKS]);

    expect(
      guard.canActivate(
        executionContext({ userId: 2, permissions: [AdminPermissions.MANAGE_BOOKS] }),
      ),
    ).toBe(true);
  });

  it('rejects authenticated users that lack all required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminPermissions.MANAGE_BOOKS]);

    expect(() => guard.canActivate(executionContext({ userId: 2, permissions: [] }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects requests without an authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminPermissions.MANAGE_BOOKS]);

    expect(guard.canActivate(executionContext())).toBe(false);
  });
});
