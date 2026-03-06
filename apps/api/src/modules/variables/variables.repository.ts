import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { sharedVariables } from './variables.schema';

@Injectable()
export class VariablesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async findByOrgId({
    orgId,
  }: {
    orgId: number;
  }): Promise<(typeof sharedVariables.$inferSelect)[]> {
    return this.db
      .select()
      .from(sharedVariables)
      .where(eq(sharedVariables.orgId, orgId))
      .orderBy(sharedVariables.key);
  }

  async findById({
    id,
    orgId,
  }: {
    id: number;
    orgId: number;
  }): Promise<typeof sharedVariables.$inferSelect | undefined> {
    const [row] = await this.db
      .select()
      .from(sharedVariables)
      .where(and(eq(sharedVariables.id, id), eq(sharedVariables.orgId, orgId)))
      .limit(1);
    return row;
  }

  async create({
    orgId,
    repoId,
    key,
    value,
    isSecret,
    description,
  }: {
    orgId: number;
    repoId?: number | null;
    key: string;
    value: string;
    isSecret?: boolean;
    description?: string | null;
  }): Promise<typeof sharedVariables.$inferSelect> {
    const [row] = await this.db
      .insert(sharedVariables)
      .values({
        orgId,
        repoId: repoId ?? null,
        key,
        value,
        isSecret: isSecret ?? false,
        description: description ?? null,
      })
      .returning();
    return row;
  }

  async update({
    id,
    orgId,
    data,
  }: {
    id: number;
    orgId: number;
    data: { value?: string; description?: string | null };
  }): Promise<typeof sharedVariables.$inferSelect | undefined> {
    const [row] = await this.db
      .update(sharedVariables)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(sharedVariables.id, id), eq(sharedVariables.orgId, orgId)))
      .returning();
    return row;
  }

  async delete({ id, orgId }: { id: number; orgId: number }): Promise<void> {
    await this.db
      .delete(sharedVariables)
      .where(and(eq(sharedVariables.id, id), eq(sharedVariables.orgId, orgId)));
  }

  async findForResolution({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<(typeof sharedVariables.$inferSelect)[]> {
    return this.db
      .select()
      .from(sharedVariables)
      .where(
        and(
          eq(sharedVariables.orgId, orgId),
          or(isNull(sharedVariables.repoId), eq(sharedVariables.repoId, repoId)),
        ),
      )
      .orderBy(sharedVariables.key);
  }
}
