import { RedisModule } from '../redis.module';

describe('RedisModule', () => {
  it('should quit the Redis client on module destroy', async () => {
    const mockRedis = {
      quit: vi.fn().mockResolvedValue('OK'),
    };

    const mod = new RedisModule(mockRedis as never);
    await mod.onModuleDestroy();

    expect(mockRedis.quit).toHaveBeenCalledOnce();
  });
});
