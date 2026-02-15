import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

@Global()
@Module({})
export class LoggingModule {
  static forRoot(): DynamicModule {
    return LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
            autoLogging: false,
            quietReqLogger: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                '*.password',
                '*.token',
                '*.secret',
                '*.refreshToken',
                '*.accessToken',
                '*.JWT_SECRET',
                '*.JWT_REFRESH_SECRET',
                '*.GITHUB_APP_PRIVATE_KEY',
                '*.GITHUB_WEBHOOK_SECRET',
                '*.GITHUB_CLIENT_SECRET',
              ],
              censor: '[REDACTED]',
            },
            genReqId: (_req: IncomingMessage, res: ServerResponse): string => {
              const existing = res.getHeader('X-Request-Id');
              if (typeof existing === 'string' && existing.length > 0) {
                return existing;
              }
              return randomUUID();
            },
          },
        };
      },
    });
  }
}
