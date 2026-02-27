import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { LoggingModule } from './common/logging/logging.module';
import { SanitizationModule } from './common/sanitization/sanitization.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { GitHubModule } from './modules/github/github.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ExecutionsModule } from './modules/executions/executions.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditModule } from './modules/audit/audit.module';
import { VariablesModule } from './modules/variables/variables.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SecretMaskingService } from './common/crypto/secret-masking.service';
import { EnvValidationService } from './common/crypto/env-validation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    LoggingModule.forRoot(),
    SanitizationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port || '6379', 10),
            password: redisUrl.password || undefined,
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    OrganizationsModule,
    GitHubModule,
    AutomationsModule,
    ExecutionsModule,
    WebhooksModule,
    AuditModule,
    VariablesModule,
    NotificationsModule,
    PermissionsModule,
    ProvidersModule,
    CleanupModule,
    HealthModule,
  ],
  providers: [
    EnvValidationService,
    SecretMaskingService,
    LoggingInterceptor,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
