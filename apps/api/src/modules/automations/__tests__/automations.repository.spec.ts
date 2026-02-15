import { type PoolClient } from 'pg';
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
  createAutomation,
  createAutomationVariable,
  resetCounters,
} from '../../../database/test/factories';
import { AutomationRepository } from '../automations.repository';

describe('AutomationRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: AutomationRepository;

  beforeEach(async () => {
    ({ db, client } = await createTestTransaction());
    repository = new AutomationRepository(db);
    resetCounters();
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function seedDependencies(): Promise<{
    user: Awaited<ReturnType<typeof createUser>>;
    org: Awaited<ReturnType<typeof createOrg>>;
    installation: Awaited<ReturnType<typeof createInstallation>>;
    repo: Awaited<ReturnType<typeof createRepository>>;
  }> {
    const user = await createUser(db);
    const org = await createOrg(db);
    const installation = await createInstallation(db, { orgId: org.id });
    const repo = await createRepository(db, {
      installationId: installation.id,
      orgId: org.id,
    });
    return { user, org, installation, repo };
  }

  describe('create', () => {
    // repository.create() uses db.transaction() internally which commits the
    // outer test transaction. Clean up committed rows to prevent duplicates.
    // Safe because tests run against the dedicated codaholiq_test database.
    afterEach(async () => {
      await client.query('DELETE FROM automation_variables');
      await client.query('DELETE FROM automations');
      await client.query('DELETE FROM repositories');
      await client.query('DELETE FROM github_installations');
      await client.query('DELETE FROM organizations');
      await client.query('DELETE FROM users');
    });

    it('should create automation without variables', async () => {
      const { user, org, repo } = await seedDependencies();

      const automation = await repository.create({
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'My Automation',
        triggerType: 'manual',
        triggerConfig: {},
        promptTemplate: 'Do something',
        workflowFile: '.github/workflows/codaholiq.yml',
      });

      expect(automation).toMatchObject({
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'My Automation',
        triggerType: 'manual',
        triggerConfig: {},
        promptTemplate: 'Do something',
        workflowFile: '.github/workflows/codaholiq.yml',
        enabled: true,
      });
      expect(automation.id).toBeDefined();
      expect(automation.createdAt).toBeInstanceOf(Date);
      expect(automation.variables).toEqual([]);
    });

    it('should create automation with variables', async () => {
      const { user, org, repo } = await seedDependencies();

      const automation = await repository.create({
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'With Vars',
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
        promptTemplate: 'Use {{API_KEY}}',
        workflowFile: '.github/workflows/codaholiq.yml',
        variables: [
          { key: 'API_KEY', value: 'abc123', source: 'static' },
          {
            key: 'BRANCH',
            value: 'main',
            source: 'static',
            required: true,
          },
        ],
      });

      expect(automation.variables).toHaveLength(2);
      const keys = automation.variables.map((v) => v.key).sort();
      expect(keys).toEqual(['API_KEY', 'BRANCH']);

      const apiKeyVar = automation.variables.find((v) => v.key === 'API_KEY');
      expect(apiKeyVar).toMatchObject({
        automationId: automation.id,
        key: 'API_KEY',
        value: 'abc123',
        source: 'static',
        required: false,
      });

      const branchVar = automation.variables.find((v) => v.key === 'BRANCH');
      expect(branchVar).toMatchObject({
        required: true,
        source: 'static',
      });
    });

    it('should reject duplicate (orgId, name) combination', async () => {
      const { user, org, repo } = await seedDependencies();

      await repository.create({
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'Duplicate Name',
        triggerType: 'manual',
        triggerConfig: {},
        promptTemplate: 'First',
        workflowFile: '.github/workflows/codaholiq.yml',
      });

      await expect(
        repository.create({
          orgId: org.id,
          repoId: repo.id,
          createdBy: user.id,
          name: 'Duplicate Name',
          triggerType: 'manual',
          triggerConfig: {},
          promptTemplate: 'Second',
          workflowFile: '.github/workflows/codaholiq.yml',
        }),
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return automation with variables when found', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'Find Me',
      });
      await createAutomationVariable(db, {
        automationId: automation.id,
        key: 'TOKEN',
        value: 'secret',
        source: 'static',
      });

      const found = await repository.findById({ id: automation.id, orgId: org.id });

      expect(found).toBeDefined();
      expect(found!.id).toBe(automation.id);
      expect(found!.name).toBe('Find Me');
      expect(found!.variables).toHaveLength(1);
      expect(found!.variables[0]).toMatchObject({
        key: 'TOKEN',
        value: 'secret',
        source: 'static',
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findById({ id: 999999, orgId: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('findByOrgId', () => {
    it('should return automations for the org', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'Auto A',
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'Auto B',
      });

      const results = await repository.findByOrgId({ orgId: org.id });

      expect(results).toHaveLength(2);
      const names = results.map((a) => a.name).sort();
      expect(names).toEqual(['Auto A', 'Auto B']);
    });

    it('should filter by triggerType', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        filters: { triggerType: 'event' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].triggerType).toBe('event');
    });

    it('should filter by enabled', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        enabled: true,
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        enabled: false,
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        filters: { enabled: false },
      });

      expect(results).toHaveLength(1);
      expect(results[0].enabled).toBe(false);
    });

    it('should filter by repoId', async () => {
      const { user, org, installation, repo } = await seedDependencies();
      const repo2 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo2.id,
        createdBy: user.id,
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        filters: { repoId: repo2.id },
      });

      expect(results).toHaveLength(1);
      expect(results[0].repoId).toBe(repo2.id);
    });

    it('should not return automations from another org', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });

      const otherOrg = await createOrg(db, {
        name: 'Other Org',
        slug: 'other-org-findbyorgid',
      });
      const otherInstallation = await createInstallation(db, {
        orgId: otherOrg.id,
      });
      const otherRepo = await createRepository(db, {
        installationId: otherInstallation.id,
        orgId: otherOrg.id,
      });
      await createAutomation(db, {
        orgId: otherOrg.id,
        repoId: otherRepo.id,
        createdBy: user.id,
      });

      const results = await repository.findByOrgId({ orgId: org.id });

      expect(results).toHaveLength(1);
      expect(results[0].orgId).toBe(org.id);
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        name: 'Original Name',
        description: null,
      });

      const updated = await repository.update({
        id: automation.id,
        orgId: org.id,
        data: {
          name: 'Updated Name',
          description: 'Now with description',
        },
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('Now with description');
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(automation.updatedAt.getTime());
    });

    it('should return undefined when automation not found', async () => {
      const updated = await repository.update({
        id: 999999,
        orgId: 999999,
        data: { name: 'Ghost' },
      });

      expect(updated).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete automation', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });

      await repository.delete({ id: automation.id, orgId: org.id });

      const found = await repository.findById({ id: automation.id, orgId: org.id });
      expect(found).toBeUndefined();
    });
  });

  describe('setEnabled', () => {
    it('should set enabled to false', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        enabled: true,
      });

      await repository.setEnabled({ id: automation.id, orgId: org.id, enabled: false });

      const found = await repository.findById({ id: automation.id, orgId: org.id });
      expect(found!.enabled).toBe(false);
    });

    it('should set enabled to true', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        enabled: false,
      });

      await repository.setEnabled({ id: automation.id, orgId: org.id, enabled: true });

      const found = await repository.findById({ id: automation.id, orgId: org.id });
      expect(found!.enabled).toBe(true);
    });
  });

  describe('findByRepoAndEvent', () => {
    it('should return automations matching the event type', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'event',
        triggerConfig: { events: ['push', 'pull_request'] },
        enabled: true,
      });

      const results = await repository.findByRepoAndEvent({
        repoId: repo.id,
        eventType: 'push',
      });

      expect(results).toHaveLength(1);
      expect(results[0].triggerType).toBe('event');
    });

    it('should not return disabled automations', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
        enabled: false,
      });

      const results = await repository.findByRepoAndEvent({
        repoId: repo.id,
        eventType: 'push',
      });

      expect(results).toHaveLength(0);
    });

    it('should not return automations with non-matching events', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'event',
        triggerConfig: { events: ['issues'] },
        enabled: true,
      });

      const results = await repository.findByRepoAndEvent({
        repoId: repo.id,
        eventType: 'push',
      });

      expect(results).toHaveLength(0);
    });

    it('should return empty array when no matches', async () => {
      const results = await repository.findByRepoAndEvent({
        repoId: 999999,
        eventType: 'push',
      });

      expect(results).toEqual([]);
    });
  });

  describe('findCronAutomations', () => {
    it('should return enabled cron automations', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
        enabled: true,
      });

      const results = await repository.findCronAutomations();

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((a) => a.triggerType === 'cron')).toBe(true);
      expect(results.every((a) => a.enabled === true)).toBe(true);
    });

    it('should not return disabled cron automations', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
        enabled: false,
        name: 'Disabled Cron',
      });

      const results = await repository.findCronAutomations();

      const match = results.find((a) => a.name === 'Disabled Cron');
      expect(match).toBeUndefined();
    });

    it('should not return non-cron automations', async () => {
      const { user, org, repo } = await seedDependencies();
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
        triggerType: 'manual',
        triggerConfig: {},
        enabled: true,
        name: 'Manual Auto',
      });

      const results = await repository.findCronAutomations();

      const match = results.find((a) => a.name === 'Manual Auto');
      expect(match).toBeUndefined();
    });
  });

  describe('upsertVariables', () => {
    it('should insert new variables', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });

      const results = await repository.upsertVariables({
        automationId: automation.id,
        variables: [
          { key: 'VAR_A', value: 'value-a', source: 'static' },
          {
            key: 'VAR_B',
            value: 'value-b',
            source: 'event_payload',
            required: true,
          },
        ],
      });

      expect(results).toHaveLength(2);
      const keys = results.map((v) => v.key).sort();
      expect(keys).toEqual(['VAR_A', 'VAR_B']);
      expect(results.find((v) => v.key === 'VAR_B')?.required).toBe(true);
    });

    it('should update existing variable on conflict', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });
      await createAutomationVariable(db, {
        automationId: automation.id,
        key: 'EXISTING',
        value: 'old-value',
        source: 'static',
      });

      const results = await repository.upsertVariables({
        automationId: automation.id,
        variables: [{ key: 'EXISTING', value: 'new-value', source: 'static' }],
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        key: 'EXISTING',
        value: 'new-value',
        source: 'static',
      });

      // Verify no duplicate was created
      const found = await repository.findById({ id: automation.id, orgId: org.id });
      const existingVars = found!.variables.filter((v) => v.key === 'EXISTING');
      expect(existingVars).toHaveLength(1);
    });
  });

  describe('deleteVariable', () => {
    it('should delete the variable', async () => {
      const { user, org, repo } = await seedDependencies();
      const automation = await createAutomation(db, {
        orgId: org.id,
        repoId: repo.id,
        createdBy: user.id,
      });
      const variable = await createAutomationVariable(db, {
        automationId: automation.id,
        key: 'TO_DELETE',
        value: 'bye',
      });

      await repository.deleteVariable({ variableId: variable.id, automationId: automation.id });

      const found = await repository.findById({ id: automation.id, orgId: org.id });
      expect(found!.variables).toHaveLength(0);
    });
  });

  describe('disableByRepoIds', () => {
    it('should disable all automations for the given repo ids', async () => {
      const org = await createOrg(db);
      const user = await createUser(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo1 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });
      const repo2 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });
      const auto1 = await createAutomation(db, {
        orgId: org.id,
        repoId: repo1.id,
        createdBy: user.id,
        enabled: true,
      });
      const auto2 = await createAutomation(db, {
        orgId: org.id,
        repoId: repo2.id,
        createdBy: user.id,
        enabled: true,
      });

      await repository.disableByRepoIds({
        repoIds: [repo1.id, repo2.id],
      });

      const found1 = await repository.findById({ id: auto1.id, orgId: org.id });
      const found2 = await repository.findById({ id: auto2.id, orgId: org.id });
      expect(found1!.enabled).toBe(false);
      expect(found2!.enabled).toBe(false);
    });

    it('should not affect automations for other repos', async () => {
      const org = await createOrg(db);
      const user = await createUser(db);
      const installation = await createInstallation(db, { orgId: org.id });
      const repo1 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });
      const repo2 = await createRepository(db, {
        installationId: installation.id,
        orgId: org.id,
      });
      await createAutomation(db, {
        orgId: org.id,
        repoId: repo1.id,
        createdBy: user.id,
        enabled: true,
      });
      const auto2 = await createAutomation(db, {
        orgId: org.id,
        repoId: repo2.id,
        createdBy: user.id,
        enabled: true,
      });

      await repository.disableByRepoIds({ repoIds: [repo1.id] });

      const found2 = await repository.findById({ id: auto2.id, orgId: org.id });
      expect(found2!.enabled).toBe(true);
    });

    it('should be a no-op for empty array', async () => {
      await expect(repository.disableByRepoIds({ repoIds: [] })).resolves.toBeUndefined();
    });
  });
});
