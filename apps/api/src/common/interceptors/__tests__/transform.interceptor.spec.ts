import { Test } from '@nestjs/testing';
import { Controller, Get, HttpCode, HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TransformInterceptor } from '../transform.interceptor';

@Controller('test')
class TestController {
  @Get('data')
  getData(): { name: string } {
    return { name: 'test' };
  }

  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  noContent(): void {
    return;
  }

  @Get('array')
  getArray(): string[] {
    return ['a', 'b'];
  }
}

describe('TransformInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should wrap response in { data, requestId }', async () => {
    const response = await request(app.getHttpServer()).get('/test/data').expect(200);

    expect(response.body).toEqual({
      data: { name: 'test' },
      requestId: expect.any(String),
    });
  });

  it('should set X-Request-Id header', async () => {
    const response = await request(app.getHttpServer()).get('/test/data').expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should pass through void responses for 204', async () => {
    await request(app.getHttpServer()).get('/test/no-content').expect(204);
  });

  it('should wrap array responses', async () => {
    const response = await request(app.getHttpServer()).get('/test/array').expect(200);

    expect(response.body).toEqual({
      data: ['a', 'b'],
      requestId: expect.any(String),
    });
  });

  it('should generate unique requestIds', async () => {
    const response1 = await request(app.getHttpServer()).get('/test/data');
    const response2 = await request(app.getHttpServer()).get('/test/data');

    expect(response1.body.requestId).not.toBe(response2.body.requestId);
  });
});
