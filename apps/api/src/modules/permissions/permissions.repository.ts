import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { orgRolePermissions } from './permissions.schema';
import * as schema from '../../database/schema';

@Injectable()
export class PermissionsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByOrgAndRole({
    orgId,
    role,
  }: {
    orgId: number;
    role: string;
  }): Promise<typeof orgRolePermissions.$inferSelect | undefined> {
    const [row] = await this.db
      .select()
      .from(orgRolePermissions)
      .where(
        and(
          eq(orgRolePermissions.orgId, orgId),
          eq(orgRolePermissions.role, role as 'owner' | 'admin' | 'member'),
        ),
      );
    return row;
  }

  async findAllByOrg({
    orgId,
  }: {
    orgId: number;
  }): Promise<(typeof orgRolePermissions.$inferSelect)[]> {
    return this.db.select().from(orgRolePermissions).where(eq(orgRolePermissions.orgId, orgId));
  }

  async upsertForOrgAndRole({
    orgId,
    role,
    permissions,
  }: {
    orgId: number;
    role: string;
    permissions: readonly string[];
  }): Promise<typeof orgRolePermissions.$inferSelect> {
    const [row] = await this.db
      .insert(orgRolePermissions)
      .values({
        orgId,
        role: role as 'owner' | 'admin' | 'member',
        permissions: [...permissions],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [orgRolePermissions.orgId, orgRolePermissions.role],
        set: {
          permissions: [...permissions],
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteByOrg({ orgId }: { orgId: number }): Promise<void> {
    await this.db.delete(orgRolePermissions).where(eq(orgRolePermissions.orgId, orgId));
  }
}
