import { Injectable, Inject } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { organizations, orgMembers } from './organizations.schema';
import { users } from '../auth/users.schema';

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async createOrg({
    name,
    slug,
    avatarUrl,
  }: {
    name: string;
    slug: string;
    avatarUrl?: string | null;
  }): Promise<typeof organizations.$inferSelect> {
    const [org] = await this.db.insert(organizations).values({ name, slug, avatarUrl }).returning();
    return org;
  }

  async findOrgById({
    id,
  }: {
    id: number;
  }): Promise<typeof organizations.$inferSelect | undefined> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return org;
  }

  async findOrgBySlug({
    slug,
  }: {
    slug: string;
  }): Promise<typeof organizations.$inferSelect | undefined> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return org;
  }

  async findOrgsByUserId({
    userId,
  }: {
    userId: number;
  }): Promise<(typeof organizations.$inferSelect)[]> {
    const rows = await this.db
      .select({ org: organizations })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, userId));
    return rows.map((row) => row.org);
  }

  async addMember({
    orgId,
    userId,
    role,
  }: {
    orgId: number;
    userId: number;
    role: 'owner' | 'admin' | 'member';
  }): Promise<typeof orgMembers.$inferSelect> {
    const [member] = await this.db.insert(orgMembers).values({ orgId, userId, role }).returning();
    return member;
  }

  async removeMember({ orgId, userId }: { orgId: number; userId: number }): Promise<void> {
    await this.db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  }

  async getMemberRole({
    orgId,
    userId,
  }: {
    orgId: number;
    userId: number;
  }): Promise<'owner' | 'admin' | 'member' | null> {
    const [row] = await this.db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1);
    return row?.role ?? null;
  }

  async countMembers({ orgId }: { orgId: number }): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(orgMembers)
      .where(eq(orgMembers.orgId, orgId));
    return Number(row.count);
  }

  async countMembersByRole({
    orgId,
    role,
  }: {
    orgId: number;
    role: 'owner' | 'admin' | 'member';
  }): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, role)));
    return Number(row.count);
  }

  async updateMemberRole({
    orgId,
    userId,
    role,
  }: {
    orgId: number;
    userId: number;
    role: 'owner' | 'admin' | 'member';
  }): Promise<void> {
    await this.db
      .update(orgMembers)
      .set({ role })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  }

  async listMembers({ orgId }: { orgId: number }): Promise<
    {
      userId: number;
      role: 'owner' | 'admin' | 'member';
      joinedAt: Date;
      username: string;
      avatarUrl: string | null;
    }[]
  > {
    const rows = await this.db
      .select({
        userId: orgMembers.userId,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId));
    return rows;
  }
}
