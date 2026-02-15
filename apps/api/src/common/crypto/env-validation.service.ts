import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvValidationService implements OnModuleInit {
  private readonly logger = new Logger(EnvValidationService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.validateJwtSecrets();
    this.validateDatabaseUrl();
    this.validateRedisUrl();
  }

  private validateJwtSecrets(): void {
    const jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters (256 bits of entropy)');
    }
    this.validateSecretEntropy(jwtSecret, 'JWT_SECRET');

    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    if (refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters (256 bits of entropy)');
    }
    this.validateSecretEntropy(refreshSecret, 'JWT_REFRESH_SECRET');

    if (jwtSecret === refreshSecret) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
    }

    this.logger.log('JWT secrets validated');
  }

  private validateSecretEntropy(secret: string, name: string): void {
    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 10) {
      throw new Error(
        `${name} has insufficient character variety (${String(uniqueChars)} unique chars). Use 'openssl rand -hex 32' to generate a strong secret.`,
      );
    }
  }

  private validateDatabaseUrl(): void {
    const url = this.config.getOrThrow<string>('DATABASE_URL');
    if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
      throw new Error(
        'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://',
      );
    }

    this.logger.log('Database URL validated');
  }

  private validateRedisUrl(): void {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — BullMQ job processing will fail at runtime');
      return;
    }

    if (!url.startsWith('redis://') && !url.startsWith('rediss://')) {
      throw new Error(
        'REDIS_URL must be a valid Redis connection string starting with redis:// or rediss://',
      );
    }

    this.logger.log('Redis URL validated');
  }
}
