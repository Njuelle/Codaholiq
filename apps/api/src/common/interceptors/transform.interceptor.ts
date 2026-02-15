import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

const VALID_REQUEST_ID = /^[\w-]{1,128}$/;

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const externalId =
      typeof request.id === 'string' && VALID_REQUEST_ID.test(request.id) ? request.id : null;
    const requestId = externalId ?? randomUUID();
    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      map((data: unknown) => {
        if (data === undefined || data === null) {
          return data;
        }
        return { data, requestId };
      }),
    );
  }
}
