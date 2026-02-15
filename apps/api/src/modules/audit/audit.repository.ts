import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { auditLogs } from './audit.schema';
import * as schema from '../../database/schema';

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create({
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
  }): Promise<typeof auditLogs.$inferSelect> {
    const [log] = await this.db
      .insert(auditLogs)
      .values({
        orgId: orgId ?? null,
        userId: userId ?? null,
        action,
        resourceType,
        resourceId: resourceId ?? null,
        details: details ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      })
      .returning();
    return log;
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
  }): Promise<(typeof auditLogs.$inferSelect)[]> {
    const conditions = [eq(auditLogs.orgId, orgId)];

    if (action) {
      conditions.push(eq(auditLogs.action, action as typeof auditLogs.$inferInsert.action));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (from) {
      conditions.push(gte(auditLogs.createdAt, from));
    }
    if (to) {
      conditions.push(lte(auditLogs.createdAt, to));
    }

    return this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit)
      .offset(offset);
  }

  async countByOrgId({
    orgId,
    action,
    userId,
    resourceType,
    from,
    to,
  }: {
    orgId: number;
    action?: string;
    userId?: number;
    resourceType?: string;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    const conditions = [eq(auditLogs.orgId, orgId)];

    if (action) {
      conditions.push(eq(auditLogs.action, action as typeof auditLogs.$inferInsert.action));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (from) {
      conditions.push(gte(auditLogs.createdAt, from));
    }
    if (to) {
      conditions.push(lte(auditLogs.createdAt, to));
    }

    const [result] = await this.db
      .select({ total: count() })
      .from(auditLogs)
      .where(and(...conditions));

    return result.total;
  }

  async deleteOlderThan({ days }: { days: number }): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM ${auditLogs} WHERE ${auditLogs.createdAt} < ${cutoff}`,
    );
    return Number(result.rowCount);
  }
}
