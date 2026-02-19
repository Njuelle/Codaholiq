import { createQueryClient } from '../query-client';
import { ApiError } from '../api-client';

describe('createQueryClient', () => {
  it('should create a QueryClient instance', () => {
    const client = createQueryClient();

    expect(client).toBeDefined();
    expect(client.getDefaultOptions()).toBeDefined();
  });

  it('should not retry on 4xx client errors', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    const retryFn = options.queries?.retry as (failureCount: number, error: Error) => boolean;

    expect(retryFn(0, new ApiError(400, 'Bad Request'))).toBe(false);
    expect(retryFn(0, new ApiError(404, 'Not Found'))).toBe(false);
    expect(retryFn(0, new ApiError(422, 'Validation Error'))).toBe(false);
  });

  it('should retry once on 5xx server errors', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    const retryFn = options.queries?.retry as (failureCount: number, error: Error) => boolean;

    expect(retryFn(0, new ApiError(500, 'Internal Server Error'))).toBe(true);
    expect(retryFn(1, new ApiError(500, 'Internal Server Error'))).toBe(false);
  });

  it('should retry once on non-ApiError errors', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    const retryFn = options.queries?.retry as (failureCount: number, error: Error) => boolean;

    expect(retryFn(0, new Error('Network error'))).toBe(true);
    expect(retryFn(1, new Error('Network error'))).toBe(false);
  });

  it('should not retry mutations', () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();

    expect(options.mutations?.retry).toBe(false);
  });
});
