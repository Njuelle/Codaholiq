import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, ilike, or, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { githubInstallations, repositories } from './github.schema';

@Injectable()
export class GitHubEntityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async upsertInstallation({
    installationId,
    orgId,
    accountLogin,
    accountType,
    suspendedAt,
  }: {
    installationId: number;
    orgId: number;
    accountLogin: string;
    accountType: 'Organization' | 'User';
    suspendedAt?: Date | null;
  }): Promise<typeof githubInstallations.$inferSelect> {
    const [installation] = await this.db
      .insert(githubInstallations)
      .values({
        installationId,
        orgId,
        accountLogin,
        accountType,
        suspendedAt: suspendedAt ?? null,
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          orgId,
          accountLogin,
          accountType,
          suspendedAt: suspendedAt ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return installation;
  }

  async deleteInstallation({ installationId }: { installationId: number }): Promise<void> {
    await this.db
      .delete(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId));
  }

  async findInstallationByOrgId({
    orgId,
  }: {
    orgId: number;
  }): Promise<typeof githubInstallations.$inferSelect | undefined> {
    const [installation] = await this.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.orgId, orgId))
      .limit(1);
    return installation;
  }

  async upsertRepository({
    githubId,
    installationId,
    orgId,
    owner,
    name,
    fullName,
    defaultBranch,
    isPrivate,
    language,
    archived,
  }: {
    githubId: number;
    installationId: number;
    orgId: number;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    language: string | null;
    archived: boolean;
  }): Promise<typeof repositories.$inferSelect> {
    const [repo] = await this.db
      .insert(repositories)
      .values({
        githubId,
        installationId,
        orgId,
        owner,
        name,
        fullName,
        defaultBranch,
        private: isPrivate,
        language,
        archived,
      })
      .onConflictDoUpdate({
        target: repositories.githubId,
        set: {
          installationId,
          orgId,
          owner,
          name,
          fullName,
          defaultBranch,
          private: isPrivate,
          language,
          archived,
          updatedAt: new Date(),
        },
      })
      .returning();
    return repo;
  }

  async findRepositoriesByOrgId({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      archived?: boolean;
      language?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };
  }): Promise<(typeof repositories.$inferSelect)[]> {
    const conditions = [eq(repositories.orgId, orgId)];

    if (filters?.archived !== undefined) {
      conditions.push(eq(repositories.archived, filters.archived));
    }
    if (filters?.language) {
      conditions.push(eq(repositories.language, filters.language));
    }
    if (filters?.search) {
      const escaped = filters.search.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(ilike(repositories.name, pattern), ilike(repositories.fullName, pattern))!,
      );
    }

    const query = this.db
      .select()
      .from(repositories)
      .where(and(...conditions))
      .orderBy(repositories.name)
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);

    return query;
  }

  async countByOrgId({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      archived?: boolean;
      language?: string;
      search?: string;
    };
  }): Promise<number> {
    const conditions = [eq(repositories.orgId, orgId)];

    if (filters?.archived !== undefined) {
      conditions.push(eq(repositories.archived, filters.archived));
    }
    if (filters?.language) {
      conditions.push(eq(repositories.language, filters.language));
    }
    if (filters?.search) {
      const escaped = filters.search.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(ilike(repositories.name, pattern), ilike(repositories.fullName, pattern))!,
      );
    }

    const [row] = await this.db
      .select({ count: count() })
      .from(repositories)
      .where(and(...conditions));
    return Number(row.count);
  }

  async findRepositoryById({
    id,
  }: {
    id: number;
  }): Promise<typeof repositories.$inferSelect | undefined> {
    const [repo] = await this.db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);
    return repo;
  }

  async findRepositoryByFullName({
    fullName,
    orgId,
  }: {
    fullName: string;
    orgId: number;
  }): Promise<typeof repositories.$inferSelect | undefined> {
    const [repo] = await this.db
      .select()
      .from(repositories)
      .where(and(eq(repositories.fullName, fullName), eq(repositories.orgId, orgId)))
      .limit(1);
    return repo;
  }

  /**
   * Finds a repository by full name across all orgs.
   *
   * SECURITY: This method intentionally skips org scoping because it is used
   * in webhook context where the org is not yet known. Callers must NOT expose
   * the returned data directly to users — use only for internal event routing.
   */
  async findRepositoryByFullNameGlobal({
    fullName,
  }: {
    fullName: string;
  }): Promise<typeof repositories.$inferSelect | undefined> {
    const [repo] = await this.db
      .select()
      .from(repositories)
      .where(eq(repositories.fullName, fullName))
      .limit(1);
    return repo;
  }

  async setWebhookActive({
    repoId,
    active,
  }: {
    repoId: number;
    active: boolean;
  }): Promise<typeof repositories.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(repositories)
      .set({ webhookActive: active, updatedAt: new Date() })
      .where(eq(repositories.id, repoId))
      .returning();
    return updated;
  }

  async findInstallationById({
    id,
  }: {
    id: number;
  }): Promise<typeof githubInstallations.$inferSelect | undefined> {
    const [installation] = await this.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.id, id))
      .limit(1);
    return installation;
  }

  async findInstallationByGitHubId({
    installationId,
  }: {
    installationId: number;
  }): Promise<typeof githubInstallations.$inferSelect | undefined> {
    const [installation] = await this.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId))
      .limit(1);
    return installation;
  }

  async updateInstallationSuspension({
    installationId,
    suspendedAt,
  }: {
    installationId: number;
    suspendedAt: Date | null;
  }): Promise<void> {
    await this.db
      .update(githubInstallations)
      .set({ suspendedAt, updatedAt: new Date() })
      .where(eq(githubInstallations.installationId, installationId));
  }

  async findRepositoriesByInstallationId({
    installationId,
  }: {
    installationId: number;
  }): Promise<(typeof repositories.$inferSelect)[]> {
    return this.db
      .select()
      .from(repositories)
      .where(eq(repositories.installationId, installationId));
  }

  async deactivateRepositoriesByIds({ repoIds }: { repoIds: readonly number[] }): Promise<void> {
    if (repoIds.length === 0) return;
    await this.db
      .update(repositories)
      .set({ webhookActive: false, updatedAt: new Date() })
      .where(inArray(repositories.id, repoIds as number[]));
  }
}
