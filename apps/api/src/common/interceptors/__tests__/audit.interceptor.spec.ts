import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from '../audit.interceptor';
import { AuditService } from '../../../modules/audit/audit.service';
import { SanitizationService } from '../../sanitization/sanitization.service';

function createMockExecutionContext(overrides: {
  params?: Record<string, string>;
  user?: { sub: number; username: string } | null;
  orgMember?: { orgId: number; userId: number; role: string } | null;
  method?: string;
  ip?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): ExecutionContext {
  const req = {
    params: overrides.params ?? {},
    user: 'user' in overrides ? overrides.user : { sub: 1, username: 'testuser' },
    orgMember:
      'orgMember' in overrides ? overrides.orgMember : { orgId: 1, userId: 1, role: 'owner' },
    method: overrides.method ?? 'POST',
    ip: overrides.ip ?? '127.0.0.1',
    body: overrides.body ?? {},
    headers: {
      'user-agent': 'TestAgent/1.0',
      ...overrides.headers,
    },
    get: vi.fn().mockImplementation((header: string) => {
      const hdrs: Record<string, string> = {
        'user-agent': 'TestAgent/1.0',
        ...overrides.headers,
      };
      return hdrs[header.toLowerCase()];
    }),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => vi.fn(),
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    getType: () => 'http' as const,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as ReturnType<ExecutionContext['switchToRpc']>,
    switchToWs: () => ({}) as ReturnType<ExecutionContext['switchToWs']>,
  } as unknown as ExecutionContext;
}

function createMockCallHandler(returnValue: unknown = {}): CallHandler {
  return {
    handle: () => of(returnValue),
  };
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockReflector: { get: ReturnType<typeof vi.fn> };
  let mockAuditService: { log: ReturnType<typeof vi.fn> };
  let mockSanitization: {
    stripHtml: ReturnType<typeof vi.fn>;
    sanitizeForStorage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockReflector = { get: vi.fn() };
    mockAuditService = { log: vi.fn() };
    mockSanitization = {
      stripHtml: vi.fn().mockImplementation(({ input }: { input: string }) => input),
      sanitizeForStorage: vi.fn().mockImplementation(({ input }: { input: string }) => input),
    };
    interceptor = new AuditInterceptor(
      mockReflector as unknown as Reflector,
      mockAuditService as unknown as AuditService,
      mockSanitization as unknown as SanitizationService,
    );
  });

  it('should skip when no @Audit() metadata is present', () => {
    mockReflector.get.mockReturnValue(undefined);
    const context = createMockExecutionContext({});
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).not.toHaveBeenCalled();
          resolve();
        },
      });
    });
  });

  it('should call auditService.log when @Audit() metadata is present', () => {
    mockReflector.get.mockReturnValue({
      action: 'automation.created',
      resourceType: 'automation',
    });

    const context = createMockExecutionContext({
      user: { sub: 5, username: 'testuser' },
      orgMember: { orgId: 3, userId: 5, role: 'owner' },
      body: { name: 'New Automation' },
    });
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).toHaveBeenCalledWith({
            orgId: 3,
            userId: 5,
            action: 'automation.created',
            resourceType: 'automation',
            resourceId: null,
            details: { name: 'New Automation' },
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent/1.0',
          });
          resolve();
        },
      });
    });
  });

  it('should extract resourceId from params when resourceIdParam is set', () => {
    mockReflector.get.mockReturnValue({
      action: 'automation.updated',
      resourceType: 'automation',
      resourceIdParam: 'automationId',
    });

    const context = createMockExecutionContext({
      params: { orgId: '1', automationId: '42' },
    });
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              resourceId: '42',
            }),
          );
          resolve();
        },
      });
    });
  });

  it('should set details to null for DELETE requests', () => {
    mockReflector.get.mockReturnValue({
      action: 'automation.deleted',
      resourceType: 'automation',
      resourceIdParam: 'automationId',
    });

    const context = createMockExecutionContext({
      method: 'DELETE',
      params: { orgId: '1', automationId: '99' },
      body: {},
    });
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              details: null,
            }),
          );
          resolve();
        },
      });
    });
  });

  it('should handle missing user and orgMember gracefully', () => {
    mockReflector.get.mockReturnValue({
      action: 'auth.login',
      resourceType: 'session',
    });

    const context = createMockExecutionContext({
      user: null,
      orgMember: null,
    });
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              orgId: null,
              userId: null,
            }),
          );
          resolve();
        },
      });
    });
  });

  it('should truncate large body details exceeding 4096 chars', () => {
    mockReflector.get.mockReturnValue({
      action: 'automation.created',
      resourceType: 'automation',
    });

    const largeBody = { data: 'x'.repeat(5000) };
    const context = createMockExecutionContext({
      body: largeBody,
    });
    const handler = createMockCallHandler();

    const result$ = interceptor.intercept(context, handler);

    return new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => {
          expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              details: expect.objectContaining({
                _truncated: true,
              }),
            }),
          );
          resolve();
        },
      });
    });
  });
});
