import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  setAccessToken,
  getAccessToken,
  setOnAuthFailure,
  refreshAccessToken,
  ApiError,
} from '../api-client';

describe('API Client', () => {
  afterEach(() => {
    setAccessToken(null);
    setOnAuthFailure(null);
  });

  describe('apiGet', () => {
    it('should unwrap the TransformInterceptor envelope', async () => {
      server.use(
        http.get('/api/test', () => {
          return HttpResponse.json({
            data: { id: 1, name: 'Test' },
            requestId: 'req-123',
          });
        }),
      );

      const result = await apiGet<{ id: number; name: string }>('/test');
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should pass query params', async () => {
      server.use(
        http.get('/api/items', ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get('limit');
          return HttpResponse.json({
            data: { limit: Number(limit) },
            requestId: 'req-123',
          });
        }),
      );

      const result = await apiGet<{ limit: number }>('/items', { limit: 10 });
      expect(result).toEqual({ limit: 10 });
    });
  });

  describe('apiPost', () => {
    it('should send body and return data', async () => {
      server.use(
        http.post('/api/items', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: { id: 1, name: body.name },
            requestId: 'req-123',
          });
        }),
      );

      const result = await apiPost<{ id: number; name: string }>('/items', {
        name: 'New Item',
      });
      expect(result).toEqual({ id: 1, name: 'New Item' });
    });
  });

  describe('apiPatch', () => {
    it('should send patch request and return data', async () => {
      server.use(
        http.patch('/api/items/1', () => {
          return HttpResponse.json({
            data: { id: 1, name: 'Updated' },
            requestId: 'req-123',
          });
        }),
      );

      const result = await apiPatch<{ id: number; name: string }>('/items/1', {
        name: 'Updated',
      });
      expect(result).toEqual({ id: 1, name: 'Updated' });
    });
  });

  describe('apiDelete', () => {
    it('should send delete request', async () => {
      server.use(
        http.delete('/api/items/1', () => {
          return new HttpResponse(null, { status: 204 });
        }),
      );

      await expect(apiDelete('/items/1')).resolves.toBeUndefined();
    });
  });

  describe('authorization header', () => {
    it('should attach Bearer token when set', async () => {
      let capturedAuth: string | null = null;
      server.use(
        http.get('/api/me', ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({
            data: { id: 1 },
            requestId: 'req-123',
          });
        }),
      );

      setAccessToken('test-token-123');
      await apiGet('/me');
      expect(capturedAuth).toBe('Bearer test-token-123');
    });

    it('should not attach Authorization header when token is null', async () => {
      let capturedAuth: string | null = null;
      server.use(
        http.get('/api/public', ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({
            data: { ok: true },
            requestId: 'req-123',
          });
        }),
      );

      setAccessToken(null);
      await apiGet('/public');
      expect(capturedAuth).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw ApiError with status and message', async () => {
      server.use(
        http.get('/api/fail', () => {
          return HttpResponse.json(
            {
              statusCode: 404,
              error: 'Not Found',
              message: 'Resource not found',
            },
            { status: 404 },
          );
        }),
      );

      try {
        await apiGet('/fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.statusCode).toBe(404);
        expect(apiError.message).toBe('Resource not found');
      }
    });

    it('should include details in ApiError when present', async () => {
      server.use(
        http.post('/api/validate', () => {
          return HttpResponse.json(
            {
              statusCode: 400,
              error: 'Bad Request',
              message: 'Validation failed',
              details: [{ field: 'name', message: 'Required' }],
            },
            { status: 400 },
          );
        }),
      );

      try {
        await apiPost('/validate', {});
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.details).toEqual([{ field: 'name', message: 'Required' }]);
      }
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new token and update stored token', async () => {
      server.use(
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json({
            data: { accessToken: 'new-token-abc' },
            requestId: 'req-123',
          });
        }),
      );

      const token = await refreshAccessToken();
      expect(token).toBe('new-token-abc');
      expect(getAccessToken()).toBe('new-token-abc');
    });

    it('should throw on refresh failure', async () => {
      server.use(
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'Missing refresh token' },
            { status: 401 },
          );
        }),
      );

      await expect(refreshAccessToken()).rejects.toThrow();
    });
  });

  describe('401 token refresh', () => {
    it('should refresh token and retry on 401', async () => {
      let callCount = 0;
      server.use(
        http.get('/api/protected', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { statusCode: 401, error: 'Unauthorized', message: 'Expired' },
              { status: 401 },
            );
          }
          return HttpResponse.json({
            data: { secret: 'data' },
            requestId: 'req-123',
          });
        }),
      );

      setAccessToken('expired-token');
      // Refresh uses cookie (sent automatically), MSW default handler returns new token

      const result = await apiGet<{ secret: string }>('/protected');
      expect(result).toEqual({ secret: 'data' });
      expect(callCount).toBe(2);
    });

    it('should call onAuthFailure when refresh fails', async () => {
      server.use(
        http.get('/api/protected', () => {
          return HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'Expired' },
            { status: 401 },
          );
        }),
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'No valid session' },
            { status: 401 },
          );
        }),
      );

      const authFailure = vi.fn();
      setOnAuthFailure(authFailure);
      setAccessToken('expired-token');

      await expect(apiGet('/protected')).rejects.toThrow();
      expect(authFailure).toHaveBeenCalled();
    });

    it('should call onAuthFailure when refresh request fails', async () => {
      server.use(
        http.get('/api/protected', () => {
          return HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'Expired' },
            { status: 401 },
          );
        }),
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'Invalid refresh' },
            { status: 401 },
          );
        }),
      );

      const authFailure = vi.fn();
      setOnAuthFailure(authFailure);
      setAccessToken('expired-token');

      await expect(apiGet('/protected')).rejects.toThrow();
      expect(authFailure).toHaveBeenCalled();
    });
  });
});
