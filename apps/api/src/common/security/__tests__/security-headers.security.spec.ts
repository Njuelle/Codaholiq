import { Test } from '@nestjs/testing';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import helmet from 'helmet';
import request from 'supertest';
import { Public } from '../../decorators/public.decorator';

@Controller()
class TestHeadersController {
  @Get('test')
  @Public()
  getData(): { status: string } {
    return { status: 'ok' };
  }
}

describe('Security Headers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [TestHeadersController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
        hsts: false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      }),
    );
    const allowedOrigin = 'http://localhost:5173';
    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin || origin === allowedOrigin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should include Content-Security-Policy header', async () => {
    const response = await request(app.getHttpServer()).get('/test').expect(200);

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain("object-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('should include X-Content-Type-Options: nosniff', async () => {
    const response = await request(app.getHttpServer()).get('/test').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-Frame-Options header', async () => {
    const response = await request(app.getHttpServer()).get('/test').expect(200);

    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should include Referrer-Policy header', async () => {
    const response = await request(app.getHttpServer()).get('/test').expect(200);

    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should include X-DNS-Prefetch-Control header', async () => {
    const response = await request(app.getHttpServer()).get('/test').expect(200);

    expect(response.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should set CORS headers for allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/test')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should reject CORS for unauthorized origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/test')
      .set('Origin', 'https://evil.com')
      .expect(500);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should restrict CORS methods on preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/test')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    const allowedMethods = response.headers['access-control-allow-methods'];
    expect(allowedMethods).toContain('GET');
    expect(allowedMethods).toContain('POST');
    expect(allowedMethods).toContain('PATCH');
    expect(allowedMethods).toContain('DELETE');
  });
});
