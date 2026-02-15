import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../jwt-auth.guard';

function createMockContext({
  authorization,
  handler = vi.fn(),
  classRef = vi.fn(),
}: {
  authorization?: string;
  handler?: () => void;
  classRef?: () => void;
}): ExecutionContext {
  const request: Record<string, unknown> = {
    headers: { authorization },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
    getHandler: () => handler,
    getClass: () => classRef,
  } as unknown as ExecutionContext;
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
  };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let verifyAsyncMock: ReturnType<typeof vi.fn>;
  let reflector: Reflector;

  beforeEach(() => {
    verifyAsyncMock = vi.fn();
    const jwtService = { verifyAsync: verifyAsyncMock } as unknown as JwtService;
    const configService = { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    reflector = new Reflector();
    guard = new JwtAuthGuard(jwtService, reflector, createMockRedis() as never, configService);
  });

  it('should allow access for @Public() routes', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should reject requests without Authorization header', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests with invalid token format', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject expired or invalid tokens', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    verifyAsyncMock.mockRejectedValue(new Error('jwt expired'));
    const context = createMockContext({ authorization: 'Bearer expired-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow valid tokens and set request.user', async () => {
    const payload = {
      sub: 1,
      username: 'octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      iat: 1000,
      exp: 2000,
    };
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    verifyAsyncMock.mockResolvedValue(payload);
    const context = createMockContext({ authorization: 'Bearer valid-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toEqual(payload);
  });
});
