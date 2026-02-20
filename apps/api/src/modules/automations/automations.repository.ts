import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { automations, automationVariables } from './automations.schema';

@Injectable()
export class AutomationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async create({
    orgId,
    repoId,
    createdBy,
    name,
    description,
    triggerType,
    triggerConfig,
    promptTemplate,
    model,
    workflowFile,
    enabled,
    variables,
  }: {
    orgId: number;
    repoId: number;
    createdBy: number;
    name: string;
    description?: string | null;
    triggerType: 'event' | 'cron' | 'manual';
    triggerConfig: Record<string, unknown>;
    promptTemplate: string;
    model?: string | null;
    workflowFile: string;
    enabled?: boolean;
    variables?: {
      key: string;
      value: string;
      source: 'static' | 'event_payload';
      required?: boolean;
    }[];
  }): Promise<
    typeof automations.$inferSelect & {
      variables: (typeof automationVariables.$inferSelect)[];
    }
  > {
    return this.db.transaction(async (tx) => {
      const [automation] = await tx
        .insert(automations)
        .values({
          orgId,
          repoId,
          createdBy,
          name,
          description: description ?? null,
          triggerType,
          triggerConfig,
          promptTemplate,
          model: model ?? null,
          workflowFile,
          enabled: enabled ?? true,
        })
        .returning();

      const insertedVariables =
        variables && variables.length > 0
          ? await tx
              .insert(automationVariables)
              .values(
                variables.map((variable) => ({
                  automationId: automation.id,
                  key: variable.key,
                  value: variable.value,
                  source: variable.source,
                  required: variable.required ?? false,
                })),
              )
              .returning()
          : [];

      return {
        ...automation,
        variables: insertedVariables,
      };
    });
  }

  async findById({ id, orgId }: { id: number; orgId: number }): Promise<
    | (typeof automations.$inferSelect & {
        variables: (typeof automationVariables.$inferSelect)[];
      })
    | undefined
  > {
    return this.db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.orgId, orgId)),
      with: { variables: true },
    });
  }

  /**
   * Internal lookup without org scoping — used only by webhook processing
   * where orgId is not known from the request context.
   */
  async findByIdInternal({ id }: { id: number }): Promise<
    | (typeof automations.$inferSelect & {
        variables: (typeof automationVariables.$inferSelect)[];
      })
    | undefined
  > {
    return this.db.query.automations.findFirst({
      where: eq(automations.id, id),
      with: { variables: true },
    });
  }

  async findByOrgId({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      triggerType?: 'event' | 'cron' | 'manual';
      enabled?: boolean;
      repoId?: number;
      limit?: number;
      offset?: number;
    };
  }): Promise<(typeof automations.$inferSelect)[]> {
    const conditions = [eq(automations.orgId, orgId)];

    if (filters?.triggerType) {
      conditions.push(eq(automations.triggerType, filters.triggerType));
    }
    if (filters?.enabled !== undefined) {
      conditions.push(eq(automations.enabled, filters.enabled));
    }
    if (filters?.repoId) {
      conditions.push(eq(automations.repoId, filters.repoId));
    }

    return this.db
      .select()
      .from(automations)
      .where(and(...conditions))
      .orderBy(automations.name)
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);
  }

  async update({
    id,
    orgId,
    data,
  }: {
    id: number;
    orgId: number;
    data: Partial<{
      name: string;
      description: string | null;
      triggerType: 'event' | 'cron' | 'manual';
      triggerConfig: Record<string, unknown>;
      promptTemplate: string;
      model: string | null;
      enabled: boolean;
    }>;
  }): Promise<typeof automations.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.orgId, orgId)))
      .returning();
    return updated;
  }

  async delete({ id, orgId }: { id: number; orgId: number }): Promise<void> {
    await this.db
      .delete(automations)
      .where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
  }

  async setEnabled({
    id,
    orgId,
    enabled,
  }: {
    id: number;
    orgId: number;
    enabled: boolean;
  }): Promise<void> {
    await this.db
      .update(automations)
      .set({ enabled, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
  }

  async findByRepoAndEvent({
    repoId,
    eventType,
  }: {
    repoId: number;
    eventType: string;
  }): Promise<(typeof automations.$inferSelect)[]> {
    const rows = await this.db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.repoId, repoId),
          eq(automations.triggerType, 'event'),
          eq(automations.enabled, true),
        ),
      );

    return rows.filter((row) => {
      const config = row.triggerConfig as { events?: string[] } | null;
      return config?.events?.includes(eventType) ?? false;
    });
  }

  async findCronAutomations(): Promise<(typeof automations.$inferSelect)[]> {
    return this.db
      .select()
      .from(automations)
      .where(and(eq(automations.triggerType, 'cron'), eq(automations.enabled, true)));
  }

  async upsertVariables({
    automationId,
    variables,
  }: {
    automationId: number;
    variables: {
      key: string;
      value: string;
      source: 'static' | 'event_payload';
      required?: boolean;
    }[];
  }): Promise<(typeof automationVariables.$inferSelect)[]> {
    const results = await Promise.all(
      variables.map((variable) =>
        this.db
          .insert(automationVariables)
          .values({
            automationId,
            key: variable.key,
            value: variable.value,
            source: variable.source,
            required: variable.required ?? false,
          })
          .onConflictDoUpdate({
            target: [automationVariables.automationId, automationVariables.key],
            set: {
              value: variable.value,
              source: variable.source,
              required: variable.required ?? false,
            },
          })
          .returning()
          .then(([result]) => result),
      ),
    );

    return results;
  }

  async deleteVariable({
    variableId,
    automationId,
  }: {
    variableId: number;
    automationId: number;
  }): Promise<void> {
    await this.db
      .delete(automationVariables)
      .where(
        and(
          eq(automationVariables.id, variableId),
          eq(automationVariables.automationId, automationId),
        ),
      );
  }

  async countByRepoId({ repoId }: { repoId: number }): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(automations)
      .where(eq(automations.repoId, repoId));
    return Number(row.count);
  }

  async countByOrgId({ orgId, enabled }: { orgId: number; enabled?: boolean }): Promise<number> {
    const conditions = [eq(automations.orgId, orgId)];
    if (enabled !== undefined) {
      conditions.push(eq(automations.enabled, enabled));
    }
    const [row] = await this.db
      .select({ count: count() })
      .from(automations)
      .where(and(...conditions));
    return Number(row.count);
  }

  async findCronAutomationsByOrgId({
    orgId,
  }: {
    orgId: number;
  }): Promise<(typeof automations.$inferSelect)[]> {
    return this.db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.orgId, orgId),
          eq(automations.triggerType, 'cron'),
          eq(automations.enabled, true),
        ),
      );
  }

  async disableByRepoIds({ repoIds }: { repoIds: readonly number[] }): Promise<void> {
    if (repoIds.length === 0) return;
    await this.db
      .update(automations)
      .set({ enabled: false, updatedAt: new Date() })
      .where(inArray(automations.repoId, repoIds as number[]));
  }
}
