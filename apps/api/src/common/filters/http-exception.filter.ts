import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { SecretMaskingService } from '../crypto/secret-masking.service';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(PinoLogger) private readonly logger: PinoLogger,
    @Inject(SecretMaskingService)
    private readonly secretMasking: SecretMaskingService,
  ) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        response.status(status).json({
          statusCode: status,
          error: HttpStatus[status],
          message: typeof resp.message === 'string' ? resp.message : exception.message,
          ...(resp.details !== undefined ? { details: resp.details } : {}),
        });
        return;
      }

      response.status(status).json({
        statusCode: status,
        error: HttpStatus[status],
        message: exception.message,
      });
      return;
    }

    if (this.isUniqueConstraintError(exception)) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Resource already exists',
      });
      return;
    }

    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const maskedMessage = this.secretMasking.mask({ text: errorMessage });

    this.logger.error(
      {
        method: request.method,
        url: request.url,
        userId: request.user?.sub,
        orgId: request.orgMember?.orgId,
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      `Unhandled exception: ${maskedMessage}`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
