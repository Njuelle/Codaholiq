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
  createSharedVariable,
  resetCounters,
} from '../../../database/test/factories';
import { VariablesRepository } from '../variables.repository';

describe('VariablesRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: VariablesRepository;

  let org: Awaited<ReturnType<typeof createOrg>>;
  let _user: Awaited<ReturnType<typeof createUser>>;
  let installation: Awaited<ReturnType<typeof createInstallation>>;
  let repo: Awaited<ReturnType<typeof createRepository>>;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());
    repository = new VariablesRepository(
      db as unknown as ConstructorParameters<typeof VariablesRepository>[0],
    );

    _user = await createUser(db);
    org = await createOrg(db);
    installation = await createInstallation(db, { orgId: org.id });
    repo = await createRepository(db, {
      installationId: installation.id,
      orgId: org.id,
    });
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('create', () => {
    it('should create an org-wide variable (repoId null)', async () => {
      const result = await repository.create({
        orgId: org.id,
        repoId: null,
        key: 'API_URL',
        value: 'https://api.example.com',
        description: 'The API base URL',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.orgId).toBe(org.id);
      expect(result.repoId).toBeNull();
      expect(result.key).toBe('API_URL');
      expect(result.value).toBe('https://api.example.com');
      expect(result.description).toBe('The API base URL');
    });

    it('should create a repo-scoped variable', async () => {
      const result = await repository.create({
        orgId: org.id,
        repoId: repo.id,
        key: 'DEPLOY_ENV',
        value: 'staging',
      });

      expect(result).toBeDefined();
      expect(result.orgId).toBe(org.id);
      expect(result.repoId).toBe(repo.id);
      expect(result.key).toBe('DEPLOY_ENV');
      expect(result.value).toBe('staging');
      expect(result.description).toBeNull();
    });

    it('should set timestamps on create', async () => {
      const result = await repository.create({
        orgId: org.id,
        key: 'TIMESTAMP_VAR',
        value: 'test',
      });

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      // Timestamps should be recent (within the last 10 seconds)
      const now = Date.now();
      expect(now - result.createdAt.getTime()).toBeLessThan(10_000);
      expect(now - result.updatedAt.getTime()).toBeLessThan(10_000);
    });
  });

  describe('findByOrgId', () => {
    it('should return all variables for org ordered by key', async () => {
      await createSharedVariable(db, { orgId: org.id, key: 'ZEBRA' });
      await createSharedVariable(db, { orgId: org.id, key: 'ALPHA' });
      await createSharedVariable(db, { orgId: org.id, key: 'MIDDLE' });

      const results = await repository.findByOrgId({ orgId: org.id });

      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('ALPHA');
      expect(results[1].key).toBe('MIDDLE');
      expect(results[2].key).toBe('ZEBRA');
    });

    it('should not return variables from other orgs', async () => {
      const otherOrg = await createOrg(db, { name: 'Other Org', slug: 'other-org' });
      await createSharedVariable(db, { orgId: org.id, key: 'MY_VAR' });
      await createSharedVariable(db, { orgId: otherOrg.id, key: 'OTHER_VAR' });

      const results = await repository.findByOrgId({ orgId: org.id });

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('MY_VAR');
      expect(results[0].orgId).toBe(org.id);
    });
  });

  describe('findById', () => {
    it('should return variable by id and orgId', async () => {
      const variable = await createSharedVariable(db, {
        orgId: org.id,
        key: 'FIND_ME',
        value: 'found',
        description: 'A findable variable',
      });

      const result = await repository.findById({ id: variable.id, orgId: org.id });

      expect(result).toBeDefined();
      expect(result!.id).toBe(variable.id);
      expect(result!.key).toBe('FIND_ME');
      expect(result!.value).toBe('found');
      expect(result!.description).toBe('A findable variable');
    });

    it('should return undefined for non-existent id', async () => {
      const result = await repository.findById({ id: 999999, orgId: org.id });

      expect(result).toBeUndefined();
    });

    it('should return undefined for variable from different org', async () => {
      const otherOrg = await createOrg(db, { name: 'Other Org', slug: 'other-org-findbyid' });
      const variable = await createSharedVariable(db, {
        orgId: otherOrg.id,
        key: 'CROSS_ORG',
      });

      const result = await repository.findById({ id: variable.id, orgId: org.id });

      expect(result).toBeUndefined();
    });
  });

  describe('findForResolution', () => {
    it('should return org-wide variables when repoId has no scoped vars', async () => {
      await createSharedVariable(db, {
        orgId: org.id,
        repoId: null,
        key: 'ORG_WIDE',
        value: 'global',
      });

      const results = await repository.findForResolution({
        orgId: org.id,
        repoId: repo.id,
      });

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('ORG_WIDE');
      expect(results[0].repoId).toBeNull();
    });

    it('should return both org-wide and repo-scoped variables', async () => {
      await createSharedVariable(db, {
        orgId: org.id,
        repoId: null,
        key: 'GLOBAL_KEY',
        value: 'global-value',
      });
      await createSharedVariable(db, {
        orgId: org.id,
        repoId: repo.id,
        key: 'REPO_KEY',
        value: 'repo-value',
      });

      const results = await repository.findForResolution({
        orgId: org.id,
        repoId: repo.id,
      });

      expect(results).toHaveLength(2);
      const keys = results.map((r) => r.key).sort();
      expect(keys).toEqual(['GLOBAL_KEY', 'REPO_KEY']);
    });

    it('should not return variables from a different org', async () => {
      const otherOrg = await createOrg(db, { name: 'Other Org', slug: 'other-org-resolution' });

      await createSharedVariable(db, {
        orgId: org.id,
        repoId: null,
        key: 'MY_ORG_VAR',
      });
      await createSharedVariable(db, {
        orgId: otherOrg.id,
        repoId: null,
        key: 'OTHER_ORG_VAR',
      });

      const results = await repository.findForResolution({
        orgId: org.id,
        repoId: repo.id,
      });

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('MY_ORG_VAR');
      expect(results[0].orgId).toBe(org.id);
    });

    it('should not return variables scoped to a different repo', async () => {
      const otherRepo = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });

      await createSharedVariable(db, {
        orgId: org.id,
        repoId: null,
        key: 'ORG_VAR',
      });
      await createSharedVariable(db, {
        orgId: org.id,
        repoId: repo.id,
        key: 'MY_REPO_VAR',
      });
      await createSharedVariable(db, {
        orgId: org.id,
        repoId: otherRepo.id,
        key: 'OTHER_REPO_VAR',
      });

      const results = await repository.findForResolution({
        orgId: org.id,
        repoId: repo.id,
      });

      expect(results).toHaveLength(2);
      const keys = results.map((r) => r.key).sort();
      expect(keys).toEqual(['MY_REPO_VAR', 'ORG_VAR']);
    });
  });

  describe('update', () => {
    it('should update value', async () => {
      const variable = await createSharedVariable(db, {
        orgId: org.id,
        key: 'UPDATE_ME',
        value: 'old-value',
      });

      const result = await repository.update({
        id: variable.id,
        orgId: org.id,
        data: { value: 'new-value' },
      });

      expect(result).toBeDefined();
      expect(result!.value).toBe('new-value');
      expect(result!.key).toBe('UPDATE_ME');
    });

    it('should update description', async () => {
      const variable = await createSharedVariable(db, {
        orgId: org.id,
        key: 'DESC_VAR',
        value: 'val',
        description: 'Old description',
      });

      const result = await repository.update({
        id: variable.id,
        orgId: org.id,
        data: { description: 'New description' },
      });

      expect(result).toBeDefined();
      expect(result!.description).toBe('New description');
    });

    it('should update updatedAt timestamp', async () => {
      const variable = await createSharedVariable(db, {
        orgId: org.id,
        key: 'TIMESTAMP_UPDATE',
        value: 'val',
      });

      const result = await repository.update({
        id: variable.id,
        orgId: org.id,
        data: { value: 'updated-val' },
      });

      expect(result).toBeDefined();
      expect(result!.updatedAt.getTime()).toBeGreaterThan(variable.updatedAt.getTime());
    });

    it('should return undefined for non-existent id', async () => {
      const result = await repository.update({
        id: 999999,
        orgId: org.id,
        data: { value: 'ghost' },
      });

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete variable by id', async () => {
      const variable = await createSharedVariable(db, {
        orgId: org.id,
        key: 'DELETE_ME',
      });

      await repository.delete({ id: variable.id, orgId: org.id });

      const found = await repository.findById({ id: variable.id, orgId: org.id });
      expect(found).toBeUndefined();
    });

    it('should not affect other variables', async () => {
      const variable1 = await createSharedVariable(db, {
        orgId: org.id,
        key: 'KEEP_ME',
      });
      const variable2 = await createSharedVariable(db, {
        orgId: org.id,
        key: 'DELETE_ME',
      });

      await repository.delete({ id: variable2.id, orgId: org.id });

      const remaining = await repository.findByOrgId({ orgId: org.id });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(variable1.id);
      expect(remaining[0].key).toBe('KEEP_ME');
    });
  });
});
