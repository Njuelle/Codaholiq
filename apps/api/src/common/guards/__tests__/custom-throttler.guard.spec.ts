import { CustomThrottlerGuard } from '../custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Instantiate with minimal constructor args — we test getTracker directly
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  describe('getTracker', () => {
    it('should track by user ID when JWT is present', async () => {
      const req = { user: { sub: 42, username: 'testuser' }, ip: '127.0.0.1' };
      const tracker = await guard['getTracker'](req as unknown as Record<string, unknown>);
      expect(tracker).toBe('user:42');
    });

    it('should track by IP when no JWT present', async () => {
      const req = { ip: '192.168.1.1' };
      const tracker = await guard['getTracker'](req as unknown as Record<string, unknown>);
      expect(tracker).toBe('ip:192.168.1.1');
    });

    it('should use "unknown" when no IP available', async () => {
      const req = {};
      const tracker = await guard['getTracker'](req as unknown as Record<string, unknown>);
      expect(tracker).toBe('ip:unknown');
    });

    it('should prefer user ID over IP when both present', async () => {
      const req = { user: { sub: 7 }, ip: '10.0.0.1' };
      const tracker = await guard['getTracker'](req as unknown as Record<string, unknown>);
      expect(tracker).toBe('user:7');
    });
  });
});
