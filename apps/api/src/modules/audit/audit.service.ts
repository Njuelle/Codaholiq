import { Injectable, Inject, Logger } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { SecretMaskingService } from '../../common/crypto/secret-masking.service';
import { auditLogs } from './audit.schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AuditRepository)
    private readonly auditRepository: AuditRepository,
    @Inject(SecretMaskingService)
    private readonly secretMasking: SecretMaskingService,
  ) {}

  log({
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress,
    userAgent,
  }: {
    orgId?: number | null;
    userId?: number | null;
    action: typeof auditLogs.$inferInsert.action;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): void {
    const maskedDetails = details ? this.secretMasking.maskObject({ obj: details }) : null;

    void this.auditRepository
      .create({
        orgId,
        userId,
        action,
        resourceType,
        resourceId,
        details: maskedDetails,
        ipAddress,
        userAgent,
      })
      .catch((error: unknown) => {
        this.logger.error({ error, action, resourceType, resourceId }, 'Failed to write audit log');
      });
  }

  async findByOrgId({
    orgId,
    action,
    userId,
    resourceType,
    from,
    to,
    limit,
    offset,
  }: {
    orgId: number;
    action?: string;
    userId?: number;
    resourceType?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }): Promise<{
    items: (typeof auditLogs.$inferSelect)[];
    total: number;
  }> {
    const [items, total] = await Promise.all([
      this.auditRepository.findByOrgId({
        orgId,
        action,
        userId,
        resourceType,
        from,
        to,
        limit,
        offset,
      }),
      this.auditRepository.countByOrgId({
        orgId,
        action,
        userId,
        resourceType,
        from,
        to,
      }),
    ]);

    return { items, total };
  }
}
