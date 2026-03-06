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
    this.validateGitHubConfig();
    this.validateUrls();
    this.validateEncryptionKey();
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
    const url = this.config.getOrThrow<string>('REDIS_URL');

    if (!url.startsWith('redis://') && !url.startsWith('rediss://')) {
      throw new Error(
        'REDIS_URL must be a valid Redis connection string starting with redis:// or rediss://',
      );
    }

    this.logger.log('Redis URL validated');
  }

  private validateGitHubConfig(): void {
    this.config.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.config.getOrThrow<string>('GITHUB_CLIENT_SECRET');
    this.config.getOrThrow<string>('GITHUB_APP_ID');
    this.config.getOrThrow<string>('GITHUB_APP_PRIVATE_KEY');
    this.config.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');

    this.logger.log('GitHub config validated');
  }

  private validateUrls(): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    for (const name of ['API_URL', 'FRONTEND_URL'] as const) {
      const url = this.config.get<string>(name);
      if (!url && isProduction) {
        throw new Error(`${name} must be set in production`);
      }
      if (url) {
        this.validateUrlFormat({ url, name, requireHttps: isProduction });
      }
    }

    this.logger.log('URL configuration validated');
  }

  private validateUrlFormat({
    url,
    name,
    requireHttps,
  }: {
    url: string;
    name: string;
    requireHttps: boolean;
  }): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`${name} must be a valid URL (got: "${url}")`);
    }

    if (requireHttps && parsed.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS in production (got: "${parsed.protocol}")`);
    }

    if (url.endsWith('/')) {
      throw new Error(`${name} must not end with a trailing slash (got: "${url}")`);
    }
  }

  private validateEncryptionKey(): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const encryptionKey = this.config.get<string>('ENCRYPTION_KEY');

    if (isProduction && !encryptionKey) {
      throw new Error(
        "ENCRYPTION_KEY must be set in production. Generate one with 'openssl rand -hex 32'.",
      );
    }

    if (encryptionKey) {
      if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
        throw new Error(
          'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32',
        );
      }
      this.logger.log('Encryption key validated');
    }
  }
}
