import { BadRequestException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhooksGuard } from '../webhooks.guard';

const TEST_SECRET = 'test-webhook-secret-for-specs';

function sign(body: string, secret: string = TEST_SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function createMockContext({
  headers = {},
  rawBody,
}: {
  headers?: Record<string, string | undefined>;
  rawBody?: Buffer;
}): ExecutionContext {
  const request: Record<string, unknown> = {
    headers,
    rawBody,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
}

describe('WebhooksGuard', () => {
  let guard: WebhooksGuard;

  beforeEach(() => {
    const configService = {
      getOrThrow: vi.fn().mockReturnValue(TEST_SECRET),
    };
    guard = new WebhooksGuard(configService as never);
  });

  it('should allow request with valid signature', () => {
    const body = JSON.stringify({ action: 'created' });
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': sign(body),
        'x-github-event': 'installation',
        'x-github-delivery': 'delivery-123',
      },
      rawBody: Buffer.from(body),
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject request with tampered payload', () => {
    const body = JSON.stringify({ action: 'created' });
    const tampered = JSON.stringify({ action: 'deleted' });
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': sign(body),
        'x-github-event': 'installation',
        'x-github-delivery': 'delivery-123',
      },
      rawBody: Buffer.from(tampered),
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with wrong secret', () => {
    const body = JSON.stringify({ action: 'created' });
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': sign(body, 'wrong-secret'),
        'x-github-event': 'installation',
        'x-github-delivery': 'delivery-123',
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with missing x-hub-signature-256 header', () => {
    const body = JSON.stringify({ action: 'created' });
    const context = createMockContext({
      headers: {
        'x-github-event': 'installation',
        'x-github-delivery': 'delivery-123',
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject request with missing x-github-event header', () => {
    const body = JSON.stringify({ action: 'created' });
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': sign(body),
        'x-github-delivery': 'delivery-123',
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject request with missing x-github-delivery header', () => {
    const body = JSON.stringify({ action: 'created' });
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': sign(body),
        'x-github-event': 'installation',
      },
      rawBody: Buffer.from(body),
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('should reject request with missing rawBody', () => {
    const context = createMockContext({
      headers: {
        'x-hub-signature-256': 'sha256=abc',
        'x-github-event': 'installation',
        'x-github-delivery': 'delivery-123',
      },
      rawBody: undefined,
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });
});
