import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, gt, gte, count, sum, sql, isNotNull, inArray, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { executions, executionLogs } from './executions.schema';
import { automations } from '../automations/automations.schema';

type ExecutionStatusValue = (typeof executions.status.enumValues)[number];

@Injectable()
export class ExecutionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  private buildCostConditions({
    orgId,
    since,
    repoId,
  }: {
    orgId: number;
    since: Date;
    repoId?: number;
  }): SQL[] {
    const conditions: SQL[] = [
      eq(automations.orgId, orgId),
      gte(executions.createdAt, since),
      isNotNull(executions.totalCostMicros),
    ];
    if (repoId !== undefined) {
      conditions.push(eq(automations.repoId, repoId));
    }
    return conditions;
  }

  async create({
    automationId,
    triggerEvent,
    resolvedPrompt,
    provider,
    model,
  }: {
    automationId: number;
    triggerEvent?: Record<string, unknown> | null;
    resolvedPrompt: string;
    provider: string;
    model?: string | null;
  }): Promise<typeof executions.$inferSelect> {
    const [execution] = await this.db
      .insert(executions)
      .values({
        automationId,
        triggerEvent: triggerEvent ?? null,
        resolvedPrompt,
        provider,
        model: model ?? null,
        status: 'pending',
      })
      .returning();
    return execution;
  }

  async findById({ id }: { id: number }): Promise<
    | {
        execution: typeof executions.$inferSelect;
        automationName: string;
        orgId: number;
      }
    | undefined
  > {
    const [row] = await this.db
      .select({
        execution: executions,
        automationName: automations.name,
        orgId: automations.orgId,
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(eq(executions.id, id))
      .limit(1);
    return row;
  }

  async findByAutomationId({
    automationId,
    filters,
  }: {
    automationId: number;
    filters?: {
      status?: ExecutionStatusValue;
      limit?: number;
      offset?: number;
    };
  }): Promise<(typeof executions.$inferSelect)[]> {
    const conditions = [eq(executions.automationId, automationId)];

    if (filters?.status) {
      conditions.push(eq(executions.status, filters.status));
    }

    return this.db
      .select()
      .from(executions)
      .where(and(...conditions))
      .orderBy(desc(executions.createdAt))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);
  }

  async findByOrgId({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      status?: ExecutionStatusValue;
      automationId?: number;
      repoId?: number;
      limit?: number;
      offset?: number;
    };
  }): Promise<{ execution: typeof executions.$inferSelect; automationName: string }[]> {
    const conditions = [eq(automations.orgId, orgId)];

    if (filters?.status) {
      conditions.push(eq(executions.status, filters.status));
    }
    if (filters?.automationId) {
      conditions.push(eq(executions.automationId, filters.automationId));
    }
    if (filters?.repoId) {
      conditions.push(eq(automations.repoId, filters.repoId));
    }

    return this.db
      .select({
        execution: executions,
        automationName: automations.name,
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...conditions))
      .orderBy(desc(executions.createdAt))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);
  }

  async countByOrgId({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      status?: ExecutionStatusValue;
      automationId?: number;
      repoId?: number;
    };
  }): Promise<number> {
    const conditions = [eq(automations.orgId, orgId)];

    if (filters?.status) {
      conditions.push(eq(executions.status, filters.status));
    }
    if (filters?.automationId) {
      conditions.push(eq(executions.automationId, filters.automationId));
    }
    if (filters?.repoId) {
      conditions.push(eq(automations.repoId, filters.repoId));
    }

    const [row] = await this.db
      .select({ count: count() })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...conditions));
    return Number(row.count);
  }

  async countByStatusInDateRange({
    orgId,
    since,
  }: {
    orgId: number;
    since: Date;
  }): Promise<{ status: string; count: number }[]> {
    const rows = await this.db
      .select({
        status: executions.status,
        count: count(),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(eq(automations.orgId, orgId), gt(executions.createdAt, since)))
      .groupBy(executions.status);

    return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  async updateStatus({
    id,
    status,
    fields,
  }: {
    id: number;
    status: ExecutionStatusValue;
    fields?: Partial<{
      githubRunId: number | null;
      githubRunUrl: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>;
  }): Promise<typeof executions.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(executions)
      .set({
        status,
        ...fields,
      })
      .where(eq(executions.id, id))
      .returning();
    return updated;
  }

  async appendLog({
    executionId,
    level,
    message,
    metadata,
  }: {
    executionId: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<typeof executionLogs.$inferSelect> {
    const [log] = await this.db
      .insert(executionLogs)
      .values({
        executionId,
        level,
        message,
        metadata: metadata ?? null,
      })
      .returning();
    return log;
  }

  async appendLogs({
    logs,
  }: {
    logs: readonly {
      executionId: number;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      metadata?: Record<string, unknown> | null;
    }[];
  }): Promise<(typeof executionLogs.$inferSelect)[]> {
    if (logs.length === 0) return [];

    const BATCH_SIZE = 5000;
    const results: (typeof executionLogs.$inferSelect)[] = [];

    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const chunk = logs.slice(i, i + BATCH_SIZE);
      const inserted = await this.db
        .insert(executionLogs)
        .values(
          chunk.map((log) => ({
            executionId: log.executionId,
            level: log.level,
            message: log.message,
            metadata: log.metadata ?? null,
          })),
        )
        .returning();
      results.push(...inserted);
    }

    return results;
  }

  async findLogs({
    executionId,
    after,
    limit,
  }: {
    executionId: number;
    after?: Date;
    limit?: number;
  }): Promise<(typeof executionLogs.$inferSelect)[]> {
    const conditions = [eq(executionLogs.executionId, executionId)];

    if (after) {
      conditions.push(gt(executionLogs.timestamp, after));
    }

    const query = this.db
      .select()
      .from(executionLogs)
      .where(and(...conditions))
      .orderBy(executionLogs.timestamp);

    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async findByGithubRunId({
    runId,
  }: {
    runId: number;
  }): Promise<typeof executions.$inferSelect | undefined> {
    const [execution] = await this.db
      .select()
      .from(executions)
      .where(eq(executions.githubRunId, runId))
      .limit(1);
    return execution;
  }

  async findByIdWithAutomationInfo({ id }: { id: number }): Promise<
    | {
        execution: typeof executions.$inferSelect;
        automationName: string;
        repoId: number;
        workflowFile: string;
        monthlyCostLimitMicros: number | null;
      }
    | undefined
  > {
    const [row] = await this.db
      .select({
        execution: executions,
        automationName: automations.name,
        repoId: automations.repoId,
        workflowFile: automations.workflowFile,
        monthlyCostLimitMicros: automations.monthlyCostLimitMicros,
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(eq(executions.id, id))
      .limit(1);
    return row;
  }

  async countByStatus({ orgId }: { orgId: number }): Promise<{ status: string; count: number }[]> {
    const rows = await this.db
      .select({
        status: executions.status,
        count: count(),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(eq(automations.orgId, orgId))
      .groupBy(executions.status);

    return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  async countActiveByOrgId({ orgId }: { orgId: number }): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(
        and(
          eq(automations.orgId, orgId),
          sql`${executions.status} IN ('pending', 'dispatching', 'running')`,
        ),
      );
    return Number(row.count);
  }

  async updateCost({
    executionId,
    inputTokens,
    outputTokens,
    totalCostMicros,
  }: {
    executionId: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalCostMicros: number | null;
  }): Promise<void> {
    await this.db
      .update(executions)
      .set({
        inputTokens,
        outputTokens,
        ...(totalCostMicros !== null ? { totalCostMicros, costCurrency: 'USD' as const } : {}),
        costReportedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
  }

  async sumCostInDateRange({
    orgId,
    since,
    repoId,
  }: {
    orgId: number;
    since: Date;
    repoId?: number;
  }): Promise<{
    totalCostMicros: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    executionsWithCost: number;
  }> {
    const [row] = await this.db
      .select({
        totalCostMicros: sum(executions.totalCostMicros),
        totalInputTokens: sum(executions.inputTokens),
        totalOutputTokens: sum(executions.outputTokens),
        executionsWithCost: count(executions.totalCostMicros),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...this.buildCostConditions({ orgId, since, repoId })));

    return {
      totalCostMicros: Number(row.totalCostMicros ?? 0),
      totalInputTokens: Number(row.totalInputTokens ?? 0),
      totalOutputTokens: Number(row.totalOutputTokens ?? 0),
      executionsWithCost: Number(row.executionsWithCost),
    };
  }

  async sumCostByProviderInDateRange({
    orgId,
    since,
    repoId,
  }: {
    orgId: number;
    since: Date;
    repoId?: number;
  }): Promise<
    { provider: string; model: string | null; totalCostMicros: number; count: number }[]
  > {
    const rows = await this.db
      .select({
        provider: executions.provider,
        model: executions.model,
        totalCostMicros: sum(executions.totalCostMicros),
        count: count(),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...this.buildCostConditions({ orgId, since, repoId })))
      .groupBy(executions.provider, executions.model);

    return rows.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalCostMicros: Number(r.totalCostMicros ?? 0),
      count: Number(r.count),
    }));
  }

  async topCostliestAutomations({
    orgId,
    since,
    limit,
    repoId,
  }: {
    orgId: number;
    since: Date;
    limit: number;
    repoId?: number;
  }): Promise<
    {
      automationId: number;
      automationName: string;
      totalCostMicros: number;
      executionCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }[]
  > {
    const rows = await this.db
      .select({
        automationId: executions.automationId,
        automationName: automations.name,
        totalCostMicros: sum(executions.totalCostMicros),
        executionCount: count(),
        totalInputTokens: sum(executions.inputTokens),
        totalOutputTokens: sum(executions.outputTokens),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...this.buildCostConditions({ orgId, since, repoId })))
      .groupBy(executions.automationId, automations.name)
      .orderBy(desc(sum(executions.totalCostMicros)))
      .limit(limit);

    return rows.map((r) => ({
      automationId: r.automationId,
      automationName: r.automationName,
      totalCostMicros: Number(r.totalCostMicros ?? 0),
      executionCount: Number(r.executionCount),
      totalInputTokens: Number(r.totalInputTokens ?? 0),
      totalOutputTokens: Number(r.totalOutputTokens ?? 0),
    }));
  }

  async deleteLogsOlderThan({ days }: { days: number }): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM ${executionLogs} WHERE ${executionLogs.timestamp} < ${cutoff}`,
    );
    return Number(result.rowCount);
  }

  async deleteExecutionsOlderThan({ days }: { days: number }): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM ${executions} WHERE ${executions.createdAt} < ${cutoff}`,
    );
    return Number(result.rowCount);
  }

  async costOverTime({
    orgId,
    from,
    to,
    repoId,
  }: {
    orgId: number;
    from: Date;
    to: Date;
    repoId?: number;
  }): Promise<
    {
      date: string;
      totalCostMicros: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      executionCount: number;
    }[]
  > {
    const conditions = this.buildCostConditions({ orgId, since: from, repoId });
    conditions.push(sql`${executions.createdAt} < ${to}`);

    const rows = await this.db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${executions.createdAt})::date::text`,
        totalCostMicros: sum(executions.totalCostMicros),
        totalInputTokens: sum(executions.inputTokens),
        totalOutputTokens: sum(executions.outputTokens),
        executionCount: count(),
      })
      .from(executions)
      .innerJoin(automations, eq(executions.automationId, automations.id))
      .where(and(...conditions))
      .groupBy(sql`DATE_TRUNC('day', ${executions.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${executions.createdAt})`);

    return rows.map((r) => ({
      date: r.date,
      totalCostMicros: Number(r.totalCostMicros ?? 0),
      totalInputTokens: Number(r.totalInputTokens ?? 0),
      totalOutputTokens: Number(r.totalOutputTokens ?? 0),
      executionCount: Number(r.executionCount),
    }));
  }

  async sumCostByAutomationInMonth({
    automationId,
    monthStart,
  }: {
    automationId: number;
    monthStart: Date;
  }): Promise<number> {
    const [row] = await this.db
      .select({
        totalCostMicros: sum(executions.totalCostMicros),
      })
      .from(executions)
      .where(
        and(
          eq(executions.automationId, automationId),
          gte(executions.createdAt, monthStart),
          isNotNull(executions.totalCostMicros),
        ),
      );
    return Number(row.totalCostMicros ?? 0);
  }

  async sumCostByAutomationIdsInMonth({
    automationIds,
    monthStart,
  }: {
    automationIds: readonly number[];
    monthStart: Date;
  }): Promise<Map<number, number>> {
    if (automationIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        automationId: executions.automationId,
        totalCostMicros: sum(executions.totalCostMicros),
      })
      .from(executions)
      .where(
        and(
          inArray(executions.automationId, automationIds as number[]),
          gte(executions.createdAt, monthStart),
          isNotNull(executions.totalCostMicros),
        ),
      )
      .groupBy(executions.automationId);

    const result = new Map<number, number>();
    for (const row of rows) {
      result.set(row.automationId, Number(row.totalCostMicros ?? 0));
    }
    return result;
  }
}
