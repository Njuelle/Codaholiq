import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, lt, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { notifications } from './notifications.schema';
import * as schema from '../../database/schema';

const MAX_NOTIFICATIONS_PER_ORG = 200;

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create({
    orgId,
    executionId,
    automationName,
    message,
  }: {
    orgId: number;
    executionId: number;
    automationName: string;
    message: string;
  }): Promise<typeof notifications.$inferSelect> {
    const [notification] = await this.db
      .insert(notifications)
      .values({ orgId, executionId, automationName, message })
      .returning();

    await this.pruneOldNotifications({ orgId });

    return notification;
  }

  async findByOrgId({
    orgId,
    limit,
  }: {
    orgId: number;
    limit?: number;
  }): Promise<(typeof notifications.$inferSelect)[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.orgId, orgId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit ?? 50);
  }

  async deleteById({ id, orgId }: { id: number; orgId: number }): Promise<boolean> {
    const result = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId)))
      .returning({ id: notifications.id });
    return result.length > 0;
  }

  async countByOrgId({ orgId }: { orgId: number }): Promise<number> {
    const [result] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(eq(notifications.orgId, orgId));
    return result.total;
  }

  async deleteOlderThan({ days }: { days: number }): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM ${notifications} WHERE ${notifications.createdAt} < ${cutoff}`,
    );
    return Number(result.rowCount);
  }

  private async pruneOldNotifications({ orgId }: { orgId: number }): Promise<void> {
    const total = await this.countByOrgId({ orgId });
    if (total <= MAX_NOTIFICATIONS_PER_ORG) return;

    const [boundary] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.orgId, orgId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(1)
      .offset(MAX_NOTIFICATIONS_PER_ORG - 1);

    if (!boundary) return;

    await this.db
      .delete(notifications)
      .where(and(eq(notifications.orgId, orgId), lt(notifications.id, boundary.id)));
  }
}
