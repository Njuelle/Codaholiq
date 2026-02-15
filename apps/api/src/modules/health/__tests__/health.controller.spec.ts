import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

const mockHealthService = {
  checkDatabase: vi.fn(),
  checkRedis: vi.fn(),
  checkGitHub: vi.fn(),
};

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return status ok', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when all dependencies are healthy', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'up',
        latencyMs: 5,
      });
      mockHealthService.checkRedis.mockResolvedValue({
        status: 'up',
        latencyMs: 2,
      });
      mockHealthService.checkGitHub.mockResolvedValue({
        status: 'up',
        latencyMs: 100,
      });

      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toEqual({
        database: { status: 'up' },
        redis: { status: 'up' },
        github: { status: 'up' },
      });
    });

    it('should return 503 when database is down', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'Connection refused',
      });
      mockHealthService.checkRedis.mockResolvedValue({
        status: 'up',
        latencyMs: 2,
      });
      mockHealthService.checkGitHub.mockResolvedValue({
        status: 'up',
        latencyMs: 100,
      });

      const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(response.body.message).toBe('Service not ready');
      expect(response.body.details.status).toBe('degraded');
      expect(response.body.details.checks.database).toEqual({ status: 'down' });
    });

    it('should return 503 when Redis is down', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'up',
        latencyMs: 5,
      });
      mockHealthService.checkRedis.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'ECONNREFUSED',
      });
      mockHealthService.checkGitHub.mockResolvedValue({
        status: 'up',
        latencyMs: 100,
      });

      const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(response.body.details.checks.redis).toEqual({ status: 'down' });
    });

    it('should still return ready when only GitHub is down', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'up',
        latencyMs: 5,
      });
      mockHealthService.checkRedis.mockResolvedValue({
        status: 'up',
        latencyMs: 2,
      });
      mockHealthService.checkGitHub.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'Network error',
      });

      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.checks.github).toEqual({ status: 'down' });
    });

    it('should return 503 when multiple dependencies are down', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'Connection refused',
      });
      mockHealthService.checkRedis.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'ECONNREFUSED',
      });
      mockHealthService.checkGitHub.mockResolvedValue({
        status: 'down',
        latencyMs: 0,
        error: 'Network error',
      });

      const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(response.body.details.status).toBe('degraded');
      expect(response.body.details.checks.database).toEqual({ status: 'down' });
      expect(response.body.details.checks.redis).toEqual({ status: 'down' });
    });
  });
});
