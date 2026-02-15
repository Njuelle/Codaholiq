import { HealthService } from '../health.service';

function createMockDb() {
  return {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
}

function createMockRedis() {
  return {
    ping: vi.fn().mockResolvedValue('PONG'),
  };
}

describe('HealthService', () => {
  let service: HealthService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRedis = createMockRedis();
    service = new HealthService(mockDb as never, mockRedis as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('checkDatabase', () => {
    it('should return up when database is healthy', async () => {
      const result = await service.checkDatabase();

      expect(result.status).toBe('up');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return down when database fails', async () => {
      mockDb.execute.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkDatabase();

      expect(result.status).toBe('down');
      expect(result.error).toBe('Service unavailable');
    });
  });

  describe('checkRedis', () => {
    it('should return up when Redis is healthy', async () => {
      const result = await service.checkRedis();

      expect(result.status).toBe('up');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return down when Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkRedis();

      expect(result.status).toBe('down');
      expect(result.error).toBe('Service unavailable');
    });
  });

  describe('checkGitHub', () => {
    it('should return up when GitHub API is reachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const result = await service.checkGitHub();

      expect(result.status).toBe('up');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return down when GitHub API returns error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

      const result = await service.checkGitHub();

      expect(result.status).toBe('down');
      expect(result.error).toBe('HTTP 503');
    });

    it('should return down when fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await service.checkGitHub();

      expect(result.status).toBe('down');
      expect(result.error).toBe('Service unavailable');
    });
  });
});
