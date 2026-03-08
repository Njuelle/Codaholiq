import type { PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  type TestDatabase,
} from '../../../database/test/test-database';
import {
  createUser,
  createOrg,
  createInstallation,
  createRepository,
  resetCounters,
} from '../../../database/test/factories';
import { ModelPoliciesRepository } from '../model-policies.repository';

describe('ModelPoliciesRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: ModelPoliciesRepository;

  let user: Awaited<ReturnType<typeof createUser>>;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let installation: Awaited<ReturnType<typeof createInstallation>>;
  let repo: Awaited<ReturnType<typeof createRepository>>;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());
    repository = new ModelPoliciesRepository(
      db as unknown as ConstructorParameters<typeof ModelPoliciesRepository>[0],
    );

    user = await createUser(db);
    org = await createOrg(db);
    installation = await createInstallation(db, { orgId: org.id });
    repo = await createRepository(db, {
      installationId: installation.id,
      orgId: org.id,
    });
  });

  afterEach(async () => {
    // setForRepo() uses db.transaction() internally which commits the
    // outer test transaction. Clean up committed rows to prevent duplicates.
    try {
      await client.query('DELETE FROM model_policies');
      await client.query('DELETE FROM repositories');
      await client.query('DELETE FROM github_installations');
      await client.query('DELETE FROM organizations');
      await client.query('DELETE FROM users');
    } catch {
      // Transaction may already be rolled back
    }
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('findByRepoId', () => {
    it('should return empty array when no policies exist', async () => {
      const result = await repository.findByRepoId({ orgId: org.id, repoId: repo.id });
      expect(result).toEqual([]);
    });

    it('should return policies for the repo', async () => {
      await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [
          { provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' },
          { provider: 'codex', model: 'codex-mini' },
        ],
        createdBy: user.id,
      });

      const result = await repository.findByRepoId({ orgId: org.id, repoId: repo.id });
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('claude-code');
      expect(result[1].provider).toBe('codex');
    });
  });

  describe('setForRepo', () => {
    it('should insert policies', async () => {
      const result = await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe(org.id);
      expect(result[0].repoId).toBe(repo.id);
      expect(result[0].provider).toBe('claude-code');
      expect(result[0].model).toBe('claude-sonnet-4-5-20250929');
      expect(result[0].createdBy).toBe(user.id);
    });

    it('should atomically replace existing policies', async () => {
      await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [
          { provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' },
          { provider: 'codex', model: 'codex-mini' },
          { provider: 'gemini', model: 'gemini-2.5-pro' },
        ],
        createdBy: user.id,
      });

      const result = await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      expect(result).toHaveLength(1);
      const all = await repository.findByRepoId({ orgId: org.id, repoId: repo.id });
      expect(all).toHaveLength(1);
    });

    it('should clear all policies when given empty array', async () => {
      await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      const result = await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [],
        createdBy: user.id,
      });

      expect(result).toEqual([]);
      const all = await repository.findByRepoId({ orgId: org.id, repoId: repo.id });
      expect(all).toHaveLength(0);
    });
  });

  describe('isModelAllowed', () => {
    it('should return true when no policies exist (unrestricted)', async () => {
      const allowed = await repository.isModelAllowed({
        orgId: org.id,
        repoId: repo.id,
        provider: 'claude-code',
        model: 'claude-sonnet-4-5-20250929',
      });
      expect(allowed).toBe(true);
    });

    it('should return true when matching policy exists', async () => {
      await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      const allowed = await repository.isModelAllowed({
        orgId: org.id,
        repoId: repo.id,
        provider: 'claude-code',
        model: 'claude-sonnet-4-5-20250929',
      });
      expect(allowed).toBe(true);
    });

    it('should return false when policies exist but no match', async () => {
      await repository.setForRepo({
        orgId: org.id,
        repoId: repo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      const allowed = await repository.isModelAllowed({
        orgId: org.id,
        repoId: repo.id,
        provider: 'codex',
        model: 'codex-mini',
      });
      expect(allowed).toBe(false);
    });
  });

  describe('org scoping', () => {
    it('should not return policies from another org', async () => {
      const otherOrg = await createOrg(db);
      const otherInstallation = await createInstallation(db, { orgId: otherOrg.id });
      const otherRepo = await createRepository(db, {
        installationId: otherInstallation.id,
        orgId: otherOrg.id,
      });

      await repository.setForRepo({
        orgId: otherOrg.id,
        repoId: otherRepo.id,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: user.id,
      });

      const result = await repository.findByRepoId({ orgId: org.id, repoId: repo.id });
      expect(result).toHaveLength(0);
    });
  });
});
