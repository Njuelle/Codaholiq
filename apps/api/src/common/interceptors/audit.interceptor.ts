import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { SanitizationService } from '../sanitization/sanitization.service';

const AUDIT_DETAILS_MAX_LENGTH = 4096;

function truncateDetails(details: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(details);
  if (json.length <= AUDIT_DETAILS_MAX_LENGTH) {
    return details;
  }
  return { _truncated: true, _originalLength: json.length };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(SanitizationService) private readonly sanitization: SanitizationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMeta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap(() => {
        const rawResourceId = auditMeta.resourceIdParam
          ? req.params[auditMeta.resourceIdParam]
          : undefined;
        const resourceId: string | null = typeof rawResourceId === 'string' ? rawResourceId : null;
        const rawUa = req.headers['user-agent'];
        const userAgent =
          typeof rawUa === 'string'
            ? this.sanitization.stripHtml({ input: rawUa }).slice(0, 512)
            : null;

        let details: Record<string, unknown> | null = null;
        if (req.method !== 'DELETE' && req.body && typeof req.body === 'object') {
          details = truncateDetails(req.body as Record<string, unknown>);
        }

        this.auditService.log({
          orgId: req.orgMember?.orgId ?? null,
          userId: req.user?.sub ?? null,
          action: auditMeta.action,
          resourceType: auditMeta.resourceType,
          resourceId,
          details,
          ipAddress: req.ip ?? null,
          userAgent,
        });
      }),
    );
  }
}
