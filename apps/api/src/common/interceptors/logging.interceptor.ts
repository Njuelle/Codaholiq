import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

const SKIP_PATHS = ['/health'];
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const SENSITIVE_PARAM_NAMES = new Set([
  'token',
  'secret',
  'key',
  'code',
  'password',
  'access_token',
  'refresh_token',
  'api_key',
  'authorization',
]);

function sanitizeLogString(input: string): string {
  return input.replace(CONTROL_CHARS, '');
}

function sanitizeUrl(url: string): string {
  const sanitized = sanitizeLogString(url);
  const questionIndex = sanitized.indexOf('?');
  if (questionIndex === -1) return sanitized;

  const path = sanitized.substring(0, questionIndex);
  const queryString = sanitized.substring(questionIndex + 1);
  const params = queryString.split('&').map((param) => {
    const eqIndex = param.indexOf('=');
    if (eqIndex === -1) return param;
    const name = param.substring(0, eqIndex).toLowerCase();
    if (SENSITIVE_PARAM_NAMES.has(name)) {
      return `${param.substring(0, eqIndex)}=[REDACTED]`;
    }
    return param;
  });
  return `${path}?${params.join('&')}`;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const url = sanitizeUrl(req.url);

    if (SKIP_PATHS.some((path) => url.startsWith(path))) {
      return next.handle();
    }

    if (url.includes('/logs/stream')) {
      return next.handle();
    }

    const userId = req.user?.sub ?? 'anonymous';
    const orgId = req.orgMember?.orgId ?? '-';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        this.logger.info(
          { method, url, userId, orgId, statusCode: res.statusCode, duration },
          `${method} ${url} ${String(res.statusCode)} (${String(duration)}ms)`,
        );
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - start;
        this.logger.warn(
          { method, url, userId, orgId, duration },
          `${method} ${url} ERROR (${String(duration)}ms)`,
        );
        throw error;
      }),
    );
  }
}
