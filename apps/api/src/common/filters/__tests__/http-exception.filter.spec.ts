import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';
import { PinoLogger } from 'nestjs-pino';
import { SecretMaskingService } from '../../crypto/secret-masking.service';

function createMockArgumentsHost(response: {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}) {
  response.status.mockReturnValue(response);
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: 'GET',
        url: '/test',
        user: { sub: 1 },
        orgMember: { orgId: 1 },
      }),
    }),
  } as never;
}

function createMockLogger(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockSecretMasking(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    mask: vi.fn().mockImplementation(({ text }: { text: string }) => text),
    maskObject: vi.fn().mockImplementation(({ obj }: { obj: Record<string, unknown> }) => obj),
  };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockMasking: ReturnType<typeof createMockSecretMasking>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMasking = createMockSecretMasking();
    filter = new HttpExceptionFilter(
      mockLogger as unknown as PinoLogger,
      mockMasking as unknown as SecretMaskingService,
    );
    mockResponse = {
      status: vi.fn(),
      json: vi.fn(),
    };
    mockResponse.status.mockReturnValue(mockResponse);
  });

  it('should handle HttpException with string response', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Not Found',
    });
  });

  it('should handle NotFoundException', () => {
    const exception = new NotFoundException('Automation not found');
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Automation not found',
    });
  });

  it('should pass through details from BadRequestException', () => {
    const details = { name: ['Required'], email: ['Invalid email'] };
    const exception = new BadRequestException({
      message: 'Validation failed',
      details,
    });
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
      details,
    });
  });

  it('should not include details when not present in exception response', () => {
    const exception = new BadRequestException('Bad input');
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const jsonArg = mockResponse.json.mock.calls[0][0] as Record<string, unknown>;
    expect(jsonArg).not.toHaveProperty('details');
  });

  it('should map pg unique constraint violation to 409 Conflict', () => {
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(pgError, host);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Resource already exists',
    });
  });

  it('should return 500 for unknown errors without leaking internals', () => {
    const exception = new Error('Something broke internally');
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });

  it('should log unhandled errors with structured context', () => {
    const exception = new Error('Something broke');
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        userId: 1,
        orgId: 1,
      }),
      expect.stringContaining('Unhandled exception'),
    );
  });

  it('should mask sensitive data in error messages', () => {
    mockMasking.mask.mockReturnValue('[REDACTED]');
    const exception = new Error('password=secret123');
    const host = createMockArgumentsHost(mockResponse);

    filter.catch(exception, host);

    expect(mockMasking.mask).toHaveBeenCalledWith({ text: 'password=secret123' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Unhandled exception: [REDACTED]',
    );
  });

  it('should handle non-Error unknown exceptions', () => {
    const host = createMockArgumentsHost(mockResponse);

    filter.catch('string error', host);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
