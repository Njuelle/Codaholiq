import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let app: INestApplication;
  let authService: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    authService = {
      handleGitHubCallback: vi.fn(),
      createAuthCode: vi.fn(),
      exchangeAuthCode: vi.fn(),
      refreshTokens: vi.fn(),
      logout: vi.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('test-client-id'),
            get: vi.fn().mockImplementation((key: string) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:5173';
              if (key === 'NODE_ENV') return 'test';
              return 'http://localhost:3000';
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(() => {
    Object.values(authService).forEach((mock) => mock.mockClear());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /auth/github', () => {
    it('should redirect to GitHub OAuth URL with state', async () => {
      const response = await request(app.getHttpServer()).get('/auth/github').expect(302);

      expect(response.headers.location).toContain('https://github.com/login/oauth/authorize');
      expect(response.headers.location).toContain('client_id=test-client-id');
      expect(response.headers.location).toContain('state=');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /auth/github/callback', () => {
    async function getOAuthState(): Promise<{ state: string; cookie: string[] }> {
      const loginResponse = await request(app.getHttpServer()).get('/auth/github');
      const setCookie = loginResponse.headers['set-cookie'];
      const cookie = Array.isArray(setCookie) ? setCookie : [setCookie];
      const stateMatch = loginResponse.headers.location.match(/state=([a-f0-9]+)/);
      return { state: stateMatch![1], cookie };
    }

    it('should redirect to frontend with auth code on successful callback', async () => {
      authService.handleGitHubCallback.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'abc-uuid.secret',
      });
      authService.createAuthCode.mockResolvedValue(
        'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
      );

      const { state, cookie } = await getOAuthState();

      const response = await request(app.getHttpServer())
        .get(`/auth/github/callback?code=test-code&state=${state}`)
        .set('Cookie', cookie)
        .expect(302);

      expect(response.headers.location).toBe(
        'http://localhost:5173/auth/callback?code=aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
      );
      expect(authService.handleGitHubCallback).toHaveBeenCalledWith({ code: 'test-code' });
      expect(authService.createAuthCode).toHaveBeenCalledWith({
        tokens: { accessToken: 'jwt-token', refreshToken: 'abc-uuid.secret' },
      });
    });

    it('should reject callback without state parameter', async () => {
      await request(app.getHttpServer()).get('/auth/github/callback?code=test-code').expect(401);
    });

    it('should reject callback with mismatched state', async () => {
      await request(app.getHttpServer())
        .get('/auth/github/callback?code=test-code&state=wrong-state')
        .set('Cookie', ['oauth_state=different-state; Path=/auth/github/callback; HttpOnly'])
        .expect(401);
    });

    it('should reject callback when state cookie is missing', async () => {
      await request(app.getHttpServer())
        .get('/auth/github/callback?code=test-code&state=some-state')
        .expect(401);
    });

    it('should return error when auth service throws', async () => {
      authService.handleGitHubCallback.mockRejectedValue(new Error('GitHub API error'));

      const { state, cookie } = await getOAuthState();

      await request(app.getHttpServer())
        .get(`/auth/github/callback?code=bad-code&state=${state}`)
        .set('Cookie', cookie)
        .expect(500);
    });

    it('should reject callback without code', async () => {
      const { state, cookie } = await getOAuthState();

      await request(app.getHttpServer())
        .get(`/auth/github/callback?state=${state}`)
        .set('Cookie', cookie)
        .expect(400);
    });
  });

  describe('POST /auth/exchange', () => {
    it('should return accessToken and set refresh cookie on valid code', async () => {
      authService.exchangeAuthCode.mockResolvedValue({
        accessToken: 'new-jwt',
        refreshToken: 'new-uuid.new-secret',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/exchange')
        .send({ code: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233' })
        .expect(200);

      expect(response.body).toEqual({ accessToken: 'new-jwt' });
      expect(authService.exchangeAuthCode).toHaveBeenCalledWith({
        code: 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233',
      });

      const cookies = response.headers['set-cookie'];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/auth');
    });

    it('should return 400 when code is missing', async () => {
      await request(app.getHttpServer()).post('/auth/exchange').send({}).expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new accessToken and rotate refresh cookie', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'new-jwt',
        refreshToken: 'new-uuid.new-secret',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['refresh_token=old-uuid.old-secret'])
        .expect(200);

      expect(response.body).toEqual({ accessToken: 'new-jwt' });
      expect(authService.refreshTokens).toHaveBeenCalledWith({
        refreshToken: 'old-uuid.old-secret',
      });

      const cookies = response.headers['set-cookie'];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
    });

    it('should return 401 when refresh cookie is missing', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should return error when refresh token is invalid', async () => {
      authService.refreshTokens.mockRejectedValue(new Error('Invalid refresh token'));

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['refresh_token=invalid.token'])
        .expect(500);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 204 and clear refresh cookie', async () => {
      authService.logout.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', ['refresh_token=uuid.secret'])
        .expect(204);

      expect(authService.logout).toHaveBeenCalledWith({ refreshToken: 'uuid.secret' });

      const cookies = response.headers['set-cookie'];
      const clearCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(clearCookie).toBeDefined();
    });

    it('should return 204 even without refresh cookie (no-op)', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);

      expect(authService.logout).not.toHaveBeenCalled();
    });
  });
});
