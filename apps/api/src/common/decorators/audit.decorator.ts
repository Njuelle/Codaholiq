import { SetMetadata } from '@nestjs/common';
import type { auditActionEnum } from '../../modules/audit/audit.schema';

export const AUDIT_KEY = 'audit';

export type AuditAction = (typeof auditActionEnum.enumValues)[number];

export interface AuditMetadata {
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceIdParam?: string;
}

export const Audit = (metadata: AuditMetadata): MethodDecorator => SetMetadata(AUDIT_KEY, metadata);
