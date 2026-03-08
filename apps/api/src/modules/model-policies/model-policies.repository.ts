import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { modelPolicies } from './model-policies.schema';

export type ModelPolicy = typeof modelPolicies.$inferSelect;

@Injectable()
export class ModelPoliciesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async findByRepoId({ orgId, repoId }: { orgId: number; repoId: number }): Promise<ModelPolicy[]> {
    return this.db
      .select()
      .from(modelPolicies)
      .where(and(eq(modelPolicies.orgId, orgId), eq(modelPolicies.repoId, repoId)))
      .orderBy(modelPolicies.provider, modelPolicies.model);
  }

  async setForRepo({
    orgId,
    repoId,
    policies,
    createdBy,
  }: {
    orgId: number;
    repoId: number;
    policies: readonly { provider: string; model: string }[];
    createdBy: number;
  }): Promise<ModelPolicy[]> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(modelPolicies)
        .where(and(eq(modelPolicies.orgId, orgId), eq(modelPolicies.repoId, repoId)));

      if (policies.length === 0) {
        return [];
      }

      return tx
        .insert(modelPolicies)
        .values(
          policies.map((p) => ({
            orgId,
            repoId,
            provider: p.provider,
            model: p.model,
            createdBy,
          })),
        )
        .returning();
    });
  }

  async isModelAllowed({
    orgId,
    repoId,
    provider,
    model,
  }: {
    orgId: number;
    repoId: number;
    provider: string;
    model: string;
  }): Promise<boolean> {
    const policies = await this.db
      .select({ provider: modelPolicies.provider, model: modelPolicies.model })
      .from(modelPolicies)
      .where(and(eq(modelPolicies.orgId, orgId), eq(modelPolicies.repoId, repoId)));

    if (policies.length === 0) {
      return true;
    }

    return policies.some((p) => p.provider === provider && p.model === model);
  }
}
