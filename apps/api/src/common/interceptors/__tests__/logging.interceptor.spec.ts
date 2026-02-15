import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  InternalServerErrorException,
  type INestApplication,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { LoggingInterceptor } from '../logging.interceptor';

const mockPinoLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  setContext: vi.fn(),
};

@Controller()
class TestController {
  @Get('test')
  getData(): { name: string } {
    return { name: 'test' };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('orgs/1/executions/1/logs/stream')
  stream(): { stream: boolean } {
    return { stream: true };
  }

  @Get('error')
  getError(): never {
    throw new InternalServerErrorException('Something broke');
  }
}

describe('LoggingInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [TestController],
      providers: [{ provide: PinoLogger, useValue: mockPinoLogger }, LoggingInterceptor],
    }).compile();

    app = moduleFixture.createNestApplication();
    const interceptor = moduleFixture.get(LoggingInterceptor);
    app.useGlobalInterceptors(interceptor);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log request with structured fields', async () => {
    await request(app.getHttpServer()).get('/test').expect(200);

    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        userId: 'anonymous',
        orgId: '-',
        statusCode: 200,
        duration: expect.any(Number) as number,
      }),
      expect.stringMatching(/GET \/test 200 \(\d+ms\)/),
    );
  });

  it('should skip logging for /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    expect(mockPinoLogger.info).not.toHaveBeenCalled();
  });

  it('should skip logging for SSE log stream endpoints', async () => {
    await request(app.getHttpServer()).get('/orgs/1/executions/1/logs/stream').expect(200);

    expect(mockPinoLogger.info).not.toHaveBeenCalled();
  });

  it('should log warning for error responses', async () => {
    await request(app.getHttpServer()).get('/error').expect(500);

    expect(mockPinoLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/error',
        userId: 'anonymous',
        orgId: '-',
        duration: expect.any(Number) as number,
      }),
      expect.stringMatching(/GET \/error ERROR \(\d+ms\)/),
    );
  });
});
