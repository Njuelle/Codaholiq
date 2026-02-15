import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { users, refreshTokens } from './users.schema';

interface GitHubProfile {
  readonly githubId: number;
  readonly username: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  async upsertUser({
    githubProfile,
  }: {
    githubProfile: GitHubProfile;
  }): Promise<typeof users.$inferSelect> {
    const [user] = await this.db
      .insert(users)
      .values({
        githubId: githubProfile.githubId,
        username: githubProfile.username,
        email: githubProfile.email,
        avatarUrl: githubProfile.avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.githubId,
        set: {
          username: githubProfile.username,
          email: githubProfile.email,
          avatarUrl: githubProfile.avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async findUserById({ id }: { id: number }): Promise<typeof users.$inferSelect | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async findByUsername({
    username,
  }: {
    username: string;
  }): Promise<typeof users.$inferSelect | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async findUserByGithubId({
    githubId,
  }: {
    githubId: number;
  }): Promise<typeof users.$inferSelect | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
    return user;
  }

  async createRefreshToken({
    userId,
    tokenHash,
    expiresAt,
  }: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<typeof refreshTokens.$inferSelect> {
    const [token] = await this.db
      .insert(refreshTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    return token;
  }

  async findRefreshToken({
    id,
  }: {
    id: string;
  }): Promise<typeof refreshTokens.$inferSelect | undefined> {
    const [token] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, id))
      .limit(1);
    return token;
  }

  async revokeRefreshToken({ id }: { id: string }): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllUserTokens({ userId }: { userId: number }): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Atomically find and lock a refresh token using SELECT ... FOR UPDATE,
   * then execute the provided callback within the same transaction to
   * ensure the lock is held for the entire operation.
   */
  async withLockedRefreshToken<T>({
    id,
    fn,
  }: {
    id: string;
    fn: (ctx: {
      token: typeof refreshTokens.$inferSelect;
      revoke: () => Promise<void>;
      revokeAll: () => Promise<void>;
    }) => Promise<T>;
  }): Promise<T | undefined> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`SELECT * FROM ${refreshTokens} WHERE ${refreshTokens.id} = ${id} FOR UPDATE`,
      );

      if (!rows.rows[0]) return undefined;

      const row = rows.rows[0] as typeof refreshTokens.$inferSelect;

      return fn({
        token: row,
        revoke: async () => {
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.id, id));
        },
        revokeAll: async () => {
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
        },
      });
    });
  }

  /**
   * Delete revoked and expired refresh tokens older than the given number of days.
   */
  async deleteExpiredTokens({ days }: { days: number }): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM ${refreshTokens}
          WHERE (${refreshTokens.revokedAt} IS NOT NULL AND ${refreshTokens.revokedAt} < ${cutoff})
             OR (${refreshTokens.expiresAt} < ${cutoff})`,
    );
    return Number(result.rowCount);
  }
}
