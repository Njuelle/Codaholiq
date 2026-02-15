import { type PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  type TestDatabase,
} from '../../../database/test/test-database';
import { createUser, createRefreshToken, resetCounters } from '../../../database/test/factories';
import { AuthRepository } from '../auth.repository';

describe('AuthRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: AuthRepository;

  beforeEach(async () => {
    ({ db, client } = await createTestTransaction());
    repository = new AuthRepository(db);
    resetCounters();
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('upsertUser', () => {
    it('should insert a new user', async () => {
      const user = await repository.upsertUser({
        githubProfile: {
          githubId: 12345,
          username: 'octocat',
          email: 'octocat@github.com',
          avatarUrl: 'https://github.com/octocat.png',
        },
      });

      expect(user).toMatchObject({
        githubId: 12345,
        username: 'octocat',
        email: 'octocat@github.com',
        avatarUrl: 'https://github.com/octocat.png',
      });
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should update an existing user on conflict', async () => {
      const original = await createUser(db, {
        githubId: 12345,
        username: 'old-name',
      });

      const updated = await repository.upsertUser({
        githubProfile: {
          githubId: 12345,
          username: 'new-name',
          email: 'new@example.com',
          avatarUrl: null,
        },
      });

      expect(updated.id).toBe(original.id);
      expect(updated.username).toBe('new-name');
      expect(updated.email).toBe('new@example.com');
    });
  });

  describe('findUserById', () => {
    it('should return the user when found', async () => {
      const created = await createUser(db);

      const found = await repository.findUserById({ id: created.id });

      expect(found).toMatchObject({
        id: created.id,
        username: created.username,
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findUserById({ id: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('findUserByGithubId', () => {
    it('should return the user when found', async () => {
      const created = await createUser(db, { githubId: 77777 });

      const found = await repository.findUserByGithubId({ githubId: 77777 });

      expect(found).toMatchObject({ id: created.id, githubId: 77777 });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findUserByGithubId({ githubId: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('createRefreshToken', () => {
    it('should create a refresh token', async () => {
      const user = await createUser(db);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const token = await repository.createRefreshToken({
        userId: user.id,
        tokenHash: 'hashed-token-value',
        expiresAt,
      });

      expect(token).toMatchObject({
        userId: user.id,
        tokenHash: 'hashed-token-value',
      });
      expect(token.id).toBeDefined();
      expect(token.revokedAt).toBeNull();
    });
  });

  describe('findRefreshToken', () => {
    it('should return the token when found', async () => {
      const user = await createUser(db);
      const created = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'some-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const found = await repository.findRefreshToken({ id: created.id });

      expect(found).toMatchObject({
        id: created.id,
        tokenHash: 'some-hash',
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findRefreshToken({
        id: '00000000-0000-0000-0000-000000000000',
      });

      expect(found).toBeUndefined();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should set revokedAt on the token', async () => {
      const user = await createUser(db);
      const token = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'to-revoke',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await repository.revokeRefreshToken({ id: token.id });

      const revoked = await repository.findRefreshToken({ id: token.id });
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    });

    it('should not revoke an already-revoked token', async () => {
      const user = await createUser(db);
      const revokedAt = new Date('2025-01-01');
      const token = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'already-revoked',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt,
      });

      await repository.revokeRefreshToken({ id: token.id });

      const found = await repository.findRefreshToken({ id: token.id });
      // revokedAt should remain the original value
      expect(found?.revokedAt?.getTime()).toBe(revokedAt.getTime());
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all active tokens for a user', async () => {
      const user = await createUser(db);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token1 = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'hash-1',
        expiresAt,
      });
      const token2 = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'hash-2',
        expiresAt,
      });

      await repository.revokeAllUserTokens({ userId: user.id });

      const found1 = await repository.findRefreshToken({ id: token1.id });
      const found2 = await repository.findRefreshToken({ id: token2.id });
      expect(found1?.revokedAt).toBeInstanceOf(Date);
      expect(found2?.revokedAt).toBeInstanceOf(Date);
    });

    it('should not affect tokens of other users', async () => {
      const user1 = await createUser(db);
      const user2 = await createUser(db);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createRefreshToken(db, {
        userId: user1.id,
        tokenHash: 'u1-hash',
        expiresAt,
      });
      const otherToken = await createRefreshToken(db, {
        userId: user2.id,
        tokenHash: 'u2-hash',
        expiresAt,
      });

      await repository.revokeAllUserTokens({ userId: user1.id });

      const found = await repository.findRefreshToken({ id: otherToken.id });
      expect(found?.revokedAt).toBeNull();
    });
  });

  describe('deleteExpiredTokens', () => {
    it('should delete revoked tokens older than the retention period', async () => {
      const user = await createUser(db);
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'old-revoked',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: oldDate,
      });

      const deleted = await repository.deleteExpiredTokens({ days: 30 });

      expect(deleted).toBe(1);
    });

    it('should delete expired tokens older than the retention period', async () => {
      const user = await createUser(db);
      const oldExpiry = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'old-expired',
        expiresAt: oldExpiry,
      });

      const deleted = await repository.deleteExpiredTokens({ days: 30 });

      expect(deleted).toBe(1);
    });

    it('should not delete recent tokens', async () => {
      const user = await createUser(db);
      const recentExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const token = await createRefreshToken(db, {
        userId: user.id,
        tokenHash: 'still-valid',
        expiresAt: recentExpiry,
      });

      const deleted = await repository.deleteExpiredTokens({ days: 30 });

      expect(deleted).toBe(0);
      const found = await repository.findRefreshToken({ id: token.id });
      expect(found).toBeDefined();
    });
  });
});
