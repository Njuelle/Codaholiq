import { ConfigService } from '@nestjs/config';
import { EnvValidationService } from '../env-validation.service';

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    JWT_SECRET: 'abcdefghij0123456789ABCDEFghij01',
    JWT_REFRESH_SECRET: 'KLMNOPQRST9876543210klmnopqrst01',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
  };
  const values = { ...defaults, ...overrides };
  return {
    get: vi.fn((key: string) => values[key]),
    getOrThrow: vi.fn((key: string) => {
      const val = values[key];
      if (!val) throw new Error(`Missing ${key}`);
      return val;
    }),
  };
}

describe('EnvValidationService', () => {
  it('should pass with valid configuration', () => {
    const config = createMockConfig();
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('should throw when JWT_SECRET is too short', () => {
    const config = createMockConfig({ JWT_SECRET: 'short' });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow('JWT_SECRET must be at least 32 characters');
  });

  it('should throw when JWT_REFRESH_SECRET is too short', () => {
    const config = createMockConfig({ JWT_REFRESH_SECRET: 'short' });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow(
      'JWT_REFRESH_SECRET must be at least 32 characters',
    );
  });

  it('should throw when DATABASE_URL is not a PostgreSQL URL', () => {
    const config = createMockConfig({
      DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
    });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow(
      'DATABASE_URL must be a valid PostgreSQL connection string',
    );
  });

  it('should accept postgres:// prefix', () => {
    const config = createMockConfig({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('should throw when JWT_SECRET has insufficient character variety', () => {
    const config = createMockConfig({ JWT_SECRET: 'a'.repeat(32) });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow('JWT_SECRET has insufficient character variety');
  });

  it('should throw when JWT_REFRESH_SECRET has insufficient character variety', () => {
    const config = createMockConfig({ JWT_REFRESH_SECRET: 'b'.repeat(32) });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow(
      'JWT_REFRESH_SECRET has insufficient character variety',
    );
  });

  it('should throw when JWT_SECRET equals JWT_REFRESH_SECRET', () => {
    const sameSecret = 'abcdefghij0123456789ABCDEF012345';
    const config = createMockConfig({
      JWT_SECRET: sameSecret,
      JWT_REFRESH_SECRET: sameSecret,
    });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow('must be different');
  });

  it('should pass with valid REDIS_URL', () => {
    const config = createMockConfig({
      REDIS_URL: 'redis://localhost:6379',
    });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('should throw for invalid REDIS_URL', () => {
    const config = createMockConfig({
      REDIS_URL: 'http://not-redis:6379',
    });
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).toThrow(
      'REDIS_URL must be a valid Redis connection string',
    );
  });

  it('should warn but not throw when REDIS_URL is missing', () => {
    const config = createMockConfig();
    config.get.mockImplementation(((key: string) => {
      if (key === 'REDIS_URL') return undefined;
      return createMockConfig().get(key);
    }) as (key: string) => string);
    const service = new EnvValidationService(config as unknown as ConfigService);

    expect(() => service.onModuleInit()).not.toThrow();
  });
});
