import { type PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  type TestDatabase,
} from '../../../database/test/test-database';
import {
  createOrg,
  createInstallation,
  createRepository,
  resetCounters,
} from '../../../database/test/factories';
import { GitHubEntityRepository } from '../github-entity.repository';

describe('GitHubEntityRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: GitHubEntityRepository;

  beforeEach(async () => {
    ({ db, client } = await createTestTransaction());
    repository = new GitHubEntityRepository(db);
    resetCounters();
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('upsertInstallation', () => {
    it('should insert a new installation', async () => {
      const org = await createOrg(db);

      const installation = await repository.upsertInstallation({
        installationId: 500001,
        orgId: org.id,
        accountLogin: 'acme-org',
        accountType: 'Organization',
      });

      expect(installation).toMatchObject({
        installationId: 500001,
        orgId: org.id,
        accountLogin: 'acme-org',
        accountType: 'Organization',
      });
      expect(installation.id).toBeDefined();
      expect(installation.createdAt).toBeInstanceOf(Date);
      expect(installation.suspendedAt).toBeNull();
    });

    it('should update on conflict (same installationId, different data)', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);

      const first = await repository.upsertInstallation({
        installationId: 500002,
        orgId: org1.id,
        accountLogin: 'old-login',
        accountType: 'User',
      });

      const updated = await repository.upsertInstallation({
        installationId: 500002,
        orgId: org2.id,
        accountLogin: 'new-login',
        accountType: 'Organization',
      });

      expect(updated.id).toBe(first.id);
      expect(updated.orgId).toBe(org2.id);
      expect(updated.accountLogin).toBe('new-login');
      expect(updated.accountType).toBe('Organization');
    });
  });

  describe('deleteInstallation', () => {
    it('should delete installation by installationId', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      await repository.deleteInstallation({
        installationId: installation.installationId,
      });

      const found = await repository.findInstallationByOrgId({
        orgId: org.id,
      });
      expect(found).toBeUndefined();
    });

    it('should not throw when installation does not exist', async () => {
      await expect(
        repository.deleteInstallation({ installationId: 999999 }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findInstallationByOrgId', () => {
    it('should return installation when found', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      const found = await repository.findInstallationByOrgId({
        orgId: org.id,
      });

      expect(found).toMatchObject({
        id: installation.id,
        installationId: installation.installationId,
        orgId: org.id,
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findInstallationByOrgId({
        orgId: 999999,
      });

      expect(found).toBeUndefined();
    });
  });

  describe('upsertRepository', () => {
    it('should insert a new repository', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      const repo = await repository.upsertRepository({
        githubId: 400001,
        installationId: installation.id,
        orgId: org.id,
        owner: 'acme',
        name: 'widgets',
        fullName: 'acme/widgets',
        defaultBranch: 'main',
        isPrivate: true,
        language: 'TypeScript',
        archived: false,
      });

      expect(repo).toMatchObject({
        githubId: 400001,
        installationId: installation.id,
        orgId: org.id,
        owner: 'acme',
        name: 'widgets',
        fullName: 'acme/widgets',
        defaultBranch: 'main',
        private: true,
        language: 'TypeScript',
        archived: false,
      });
      expect(repo.id).toBeDefined();
      expect(repo.createdAt).toBeInstanceOf(Date);
    });

    it('should update on conflict (same githubId, different data)', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      const first = await repository.upsertRepository({
        githubId: 400002,
        installationId: installation.id,
        orgId: org.id,
        owner: 'acme',
        name: 'old-name',
        fullName: 'acme/old-name',
        defaultBranch: 'main',
        isPrivate: false,
        language: 'JavaScript',
        archived: false,
      });

      const updated = await repository.upsertRepository({
        githubId: 400002,
        installationId: installation.id,
        orgId: org.id,
        owner: 'acme',
        name: 'new-name',
        fullName: 'acme/new-name',
        defaultBranch: 'develop',
        isPrivate: true,
        language: 'TypeScript',
        archived: true,
      });

      expect(updated.id).toBe(first.id);
      expect(updated.name).toBe('new-name');
      expect(updated.fullName).toBe('acme/new-name');
      expect(updated.defaultBranch).toBe('develop');
      expect(updated.private).toBe(true);
      expect(updated.language).toBe('TypeScript');
      expect(updated.archived).toBe(true);
    });
  });

  describe('findRepositoriesByOrgId', () => {
    it('should return repos for the given org', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'alpha',
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'beta',
      });

      const repos = await repository.findRepositoriesByOrgId({
        orgId: org.id,
      });

      expect(repos).toHaveLength(2);
      const names = repos.map((r) => r.name).sort();
      expect(names).toEqual(['alpha', 'beta']);
    });

    it('should return empty array for org with no repos', async () => {
      const org = await createOrg(db);

      const repos = await repository.findRepositoriesByOrgId({
        orgId: org.id,
      });

      expect(repos).toEqual([]);
    });

    it('should filter by archived', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'active-repo',
        archived: false,
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'archived-repo',
        archived: true,
      });

      const repos = await repository.findRepositoriesByOrgId({
        orgId: org.id,
        filters: { archived: true },
      });

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('archived-repo');
    });

    it('should filter by language', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'ts-repo',
        language: 'TypeScript',
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'py-repo',
        language: 'Python',
      });

      const repos = await repository.findRepositoriesByOrgId({
        orgId: org.id,
        filters: { language: 'TypeScript' },
      });

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('ts-repo');
    });

    it('should respect pagination (limit/offset)', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'aaa',
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'bbb',
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'ccc',
      });

      const page1 = await repository.findRepositoriesByOrgId({
        orgId: org.id,
        filters: { limit: 2, offset: 0 },
      });
      const page2 = await repository.findRepositoriesByOrgId({
        orgId: org.id,
        filters: { limit: 2, offset: 2 },
      });

      expect(page1).toHaveLength(2);
      expect(page1[0].name).toBe('aaa');
      expect(page1[1].name).toBe('bbb');
      expect(page2).toHaveLength(1);
      expect(page2[0].name).toBe('ccc');
    });

    it('should not return repos from another org (org scoping)', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);
      const installation1 = await createInstallation(db, { orgId: org1.id });
      const installation2 = await createInstallation(db, { orgId: org2.id });
      await createRepository(db, {
        installationId: installation1.id,
        orgId: org1.id,
        name: 'org1-repo',
      });
      await createRepository(db, {
        installationId: installation2.id,
        orgId: org2.id,
        name: 'org2-repo',
      });

      const repos = await repository.findRepositoriesByOrgId({
        orgId: org1.id,
      });

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('org1-repo');
    });
  });

  describe('findRepositoryById', () => {
    it('should return repo when found', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const created = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });

      const found = await repository.findRepositoryById({ id: created.id });

      expect(found).toMatchObject({
        id: created.id,
        orgId: org.id,
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findRepositoryById({ id: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('findRepositoryByFullName', () => {
    it('should return repo when found', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const created = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        fullName: 'acme/widgets',
      });

      const found = await repository.findRepositoryByFullName({
        fullName: 'acme/widgets',
        orgId: org.id,
      });

      expect(found).toMatchObject({
        id: created.id,
        fullName: 'acme/widgets',
      });
    });

    it('should return undefined when not found', async () => {
      const org = await createOrg(db);

      const found = await repository.findRepositoryByFullName({
        fullName: 'nonexistent/repo',
        orgId: org.id,
      });

      expect(found).toBeUndefined();
    });

    it('should not return repo from another org', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org1.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org1.id,
        fullName: 'acme/secret-repo',
      });

      const found = await repository.findRepositoryByFullName({
        fullName: 'acme/secret-repo',
        orgId: org2.id,
      });

      expect(found).toBeUndefined();
    });
  });

  describe('setWebhookActive', () => {
    it('should set webhookActive to false', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: true,
      });

      await repository.setWebhookActive({ repoId: repo.id, active: false });

      const found = await repository.findRepositoryById({ id: repo.id });
      expect(found?.webhookActive).toBe(false);
    });

    it('should set webhookActive to true', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: false,
      });

      await repository.setWebhookActive({ repoId: repo.id, active: true });

      const found = await repository.findRepositoryById({ id: repo.id });
      expect(found?.webhookActive).toBe(true);
    });
  });

  describe('findInstallationById', () => {
    it('should return installation when found by DB id', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, {
        orgId: org.id,
        installationId: 700001,
      });

      const found = await repository.findInstallationById({
        id: installation.id,
      });

      expect(found).toMatchObject({
        id: installation.id,
        installationId: 700001,
        orgId: org.id,
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findInstallationById({ id: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('findInstallationByGitHubId', () => {
    it('should return installation when found', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, {
        orgId: org.id,
        installationId: 600001,
      });

      const found = await repository.findInstallationByGitHubId({
        installationId: 600001,
      });

      expect(found).toMatchObject({
        id: installation.id,
        installationId: 600001,
        orgId: org.id,
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findInstallationByGitHubId({
        installationId: 999999,
      });

      expect(found).toBeUndefined();
    });
  });

  describe('updateInstallationSuspension', () => {
    it('should set suspendedAt on an installation', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const suspendedAt = new Date('2025-06-01T00:00:00Z');

      await repository.updateInstallationSuspension({
        installationId: installation.installationId,
        suspendedAt,
      });

      const found = await repository.findInstallationByGitHubId({
        installationId: installation.installationId,
      });
      expect(found?.suspendedAt).toEqual(suspendedAt);
    });

    it('should clear suspendedAt on an installation', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      await repository.updateInstallationSuspension({
        installationId: installation.installationId,
        suspendedAt: new Date(),
      });
      await repository.updateInstallationSuspension({
        installationId: installation.installationId,
        suspendedAt: null,
      });

      const found = await repository.findInstallationByGitHubId({
        installationId: installation.installationId,
      });
      expect(found?.suspendedAt).toBeNull();
    });
  });

  describe('findRepositoriesByInstallationId', () => {
    it('should return repos for the given installation', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'repo-a',
      });
      await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        name: 'repo-b',
      });

      const repos = await repository.findRepositoriesByInstallationId({
        installationId: installation.id,
      });

      expect(repos).toHaveLength(2);
    });

    it('should return empty array when no repos exist', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });

      const repos = await repository.findRepositoriesByInstallationId({
        installationId: installation.id,
      });

      expect(repos).toEqual([]);
    });

    it('should not return repos from another installation', async () => {
      const org = await createOrg(db);
      const inst1 = await createInstallation(db, { orgId: org.id });
      const inst2 = await createInstallation(db, { orgId: org.id });
      await createRepository(db, {
        installationId: inst1.id,
        orgId: org.id,
        name: 'inst1-repo',
      });
      await createRepository(db, {
        installationId: inst2.id,
        orgId: org.id,
        name: 'inst2-repo',
      });

      const repos = await repository.findRepositoriesByInstallationId({
        installationId: inst1.id,
      });

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('inst1-repo');
    });
  });

  describe('deactivateRepositoriesByIds', () => {
    it('should set webhookActive to false for given repo ids', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo1 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: true,
      });
      const repo2 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: true,
      });

      await repository.deactivateRepositoriesByIds({
        repoIds: [repo1.id, repo2.id],
      });

      const found1 = await repository.findRepositoryById({ id: repo1.id });
      const found2 = await repository.findRepositoryById({ id: repo2.id });
      expect(found1?.webhookActive).toBe(false);
      expect(found2?.webhookActive).toBe(false);
    });

    it('should not affect repos not in the list', async () => {
      const org = await createOrg(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo1 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: true,
      });
      const repo2 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
        webhookActive: true,
      });

      await repository.deactivateRepositoriesByIds({
        repoIds: [repo1.id],
      });

      const found2 = await repository.findRepositoryById({ id: repo2.id });
      expect(found2?.webhookActive).toBe(true);
    });

    it('should be a no-op for empty array', async () => {
      await expect(
        repository.deactivateRepositoriesByIds({ repoIds: [] }),
      ).resolves.toBeUndefined();
    });
  });
});
