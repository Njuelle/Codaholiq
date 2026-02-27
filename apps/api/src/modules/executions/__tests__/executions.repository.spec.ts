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
  createExecution,
  createExecutionLog,
  resetCounters,
} from '../../../database/test/factories';
import { executions, executionLogs } from '../executions.schema';
import { ExecutionRepository } from '../executions.repository';

describe('ExecutionRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: ExecutionRepository;

  beforeEach(async () => {
    ({ db, client } = await createTestTransaction());
    repository = new ExecutionRepository(db);
    resetCounters();
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function seedAutomation(): Promise<{
    user: Awaited<ReturnType<typeof createUser>>;
    org: Awaited<ReturnType<typeof createOrg>>;
    automation: Awaited<ReturnType<typeof createAutomation>>;
  }> {
    const user = await createUser(db);
    const org = await createOrg(db);
    const installation = await createInstallation(db, { orgId: org.id });
    const repo = await createRepository(db, {
      installationId: installation.id,
      orgId: org.id,
    });
    const automation = await createAutomation(db, {
      orgId: org.id,
      repoId: repo.id,
      createdBy: user.id,
    });
    return { user, org, automation };
  }

  describe('create', () => {
    it('should create execution with pending status', async () => {
      const { automation } = await seedAutomation();

      const execution = await repository.create({
        automationId: automation.id,
        resolvedPrompt: 'Fix the login bug',
        provider: 'claude-code',
      });

      expect(execution).toMatchObject({
        automationId: automation.id,
        resolvedPrompt: 'Fix the login bug',
        status: 'pending',
        triggerEvent: null,
      });
      expect(execution.id).toBeDefined();
      expect(execution.createdAt).toBeInstanceOf(Date);
    });

    it('should store triggerEvent when provided', async () => {
      const { automation } = await seedAutomation();
      const triggerEvent = { action: 'opened', pull_request: { number: 42 } };

      const execution = await repository.create({
        automationId: automation.id,
        triggerEvent,
        resolvedPrompt: 'Review PR #42',
        provider: 'claude-code',
      });

      expect(execution.triggerEvent).toEqual(triggerEvent);
    });
  });

  describe('findById', () => {
    it('should return execution with automation name', async () => {
      const { automation } = await seedAutomation();
      const created = await createExecution(db, {
        automationId: automation.id,
        resolvedPrompt: 'Test prompt',
      });

      const result = await repository.findById({ id: created.id });

      expect(result).toBeDefined();
      expect(result!.execution.id).toBe(created.id);
      expect(result!.automationName).toBe(automation.name);
    });

    it('should return undefined when not found', async () => {
      const result = await repository.findById({ id: 999999 });

      expect(result).toBeUndefined();
    });
  });

  describe('findByAutomationId', () => {
    it('should return executions for the automation', async () => {
      const { automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id });
      await createExecution(db, { automationId: automation.id });

      const results = await repository.findByAutomationId({
        automationId: automation.id,
      });

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.automationId).toBe(automation.id);
      });
    });

    it('should filter by status', async () => {
      const { automation } = await seedAutomation();
      await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'running',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'completed',
      });

      const results = await repository.findByAutomationId({
        automationId: automation.id,
        filters: { status: 'running' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('running');
    });

    it('should order by createdAt desc', async () => {
      const { automation } = await seedAutomation();
      const [first] = await db
        .insert(executions)
        .values({
          automationId: automation.id,
          resolvedPrompt: 'First prompt',
          status: 'pending',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        })
        .returning();
      const [second] = await db
        .insert(executions)
        .values({
          automationId: automation.id,
          resolvedPrompt: 'Second prompt',
          status: 'pending',
          createdAt: new Date('2025-01-02T00:00:00Z'),
        })
        .returning();

      const results = await repository.findByAutomationId({
        automationId: automation.id,
      });

      expect(results[0].id).toBe(second.id);
      expect(results[1].id).toBe(first.id);
    });

    it('should return empty array when no executions', async () => {
      const { automation } = await seedAutomation();

      const results = await repository.findByAutomationId({
        automationId: automation.id,
      });

      expect(results).toEqual([]);
    });
  });

  describe('findByOrgId', () => {
    it('should return executions for the org', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id });
      await createExecution(db, { automationId: automation.id });

      const results = await repository.findByOrgId({ orgId: org.id });

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.execution.automationId).toBe(automation.id);
        expect(r.automationName).toBe(automation.name);
      });
    });

    it('should filter by status', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'failed',
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        filters: { status: 'failed' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].execution.status).toBe('failed');
    });

    it('should not return executions from another org', async () => {
      const { automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id });

      // Create a second org with its own chain
      const otherOrg = await createOrg(db, {
        name: 'Other Org',
        slug: 'other-org',
      });
      const otherInstallation = await createInstallation(db, {
        orgId: otherOrg.id,
      });
      const otherRepo = await createRepository(db, {
        installationId: otherInstallation.id,
        orgId: otherOrg.id,
      });
      const otherUser = await createUser(db);
      const otherAutomation = await createAutomation(db, {
        orgId: otherOrg.id,
        repoId: otherRepo.id,
        createdBy: otherUser.id,
      });
      await createExecution(db, { automationId: otherAutomation.id });

      const results = await repository.findByOrgId({ orgId: otherOrg.id });

      expect(results).toHaveLength(1);
      expect(results[0].execution.automationId).toBe(otherAutomation.id);
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });

      const updated = await repository.updateStatus({
        id: execution.id,
        status: 'running',
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('running');
    });

    it('should update status with additional fields', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
        status: 'running',
      });
      const startedAt = new Date('2025-01-15T10:00:00Z');
      const completedAt = new Date('2025-01-15T10:05:00Z');

      const updated = await repository.updateStatus({
        id: execution.id,
        status: 'completed',
        fields: {
          githubRunId: 12345678,
          githubRunUrl: 'https://github.com/org/repo/actions/runs/12345678',
          startedAt,
          completedAt,
        },
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('completed');
      expect(updated!.githubRunId).toBe(12345678);
      expect(updated!.githubRunUrl).toBe('https://github.com/org/repo/actions/runs/12345678');
      expect(updated!.startedAt).toEqual(startedAt);
      expect(updated!.completedAt).toEqual(completedAt);
    });

    it('should return undefined when execution not found', async () => {
      const updated = await repository.updateStatus({
        id: 999999,
        status: 'running',
      });

      expect(updated).toBeUndefined();
    });
  });

  describe('appendLog', () => {
    it('should create an execution log entry', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
      });

      const log = await repository.appendLog({
        executionId: execution.id,
        level: 'info',
        message: 'Workflow started',
      });

      expect(log).toMatchObject({
        executionId: execution.id,
        level: 'info',
        message: 'Workflow started',
        metadata: null,
      });
      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('should store metadata when provided', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
      });
      const metadata = { step: 'checkout', duration_ms: 1500 };

      const log = await repository.appendLog({
        executionId: execution.id,
        level: 'debug',
        message: 'Step completed',
        metadata,
      });

      expect(log.metadata).toEqual(metadata);
    });
  });

  describe('findLogs', () => {
    it('should return logs ordered by timestamp', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
      });
      const log1 = await createExecutionLog(db, {
        executionId: execution.id,
        level: 'info',
        message: 'First',
      });
      const log2 = await createExecutionLog(db, {
        executionId: execution.id,
        level: 'info',
        message: 'Second',
      });

      const logs = await repository.findLogs({ executionId: execution.id });

      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe(log1.id);
      expect(logs[1].id).toBe(log2.id);
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(logs[1].timestamp.getTime());
    });

    it('should filter logs after a given timestamp', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
      });
      const earlyTimestamp = new Date('2025-01-01T00:00:00Z');
      const laterTimestamp = new Date('2025-01-01T01:00:00Z');
      await db.insert(executionLogs).values({
        executionId: execution.id,
        level: 'info',
        message: 'Early log',
        timestamp: earlyTimestamp,
      });
      await db.insert(executionLogs).values({
        executionId: execution.id,
        level: 'info',
        message: 'Later log',
        timestamp: laterTimestamp,
      });

      const logs = await repository.findLogs({
        executionId: execution.id,
        after: earlyTimestamp,
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Later log');
    });

    it('should return empty array when no logs', async () => {
      const { automation } = await seedAutomation();
      const execution = await createExecution(db, {
        automationId: automation.id,
      });

      const logs = await repository.findLogs({ executionId: execution.id });

      expect(logs).toEqual([]);
    });
  });

  describe('findByGithubRunId', () => {
    it('should return execution when found', async () => {
      const { automation } = await seedAutomation();
      const created = await createExecution(db, {
        automationId: automation.id,
        githubRunId: 98765432,
      });

      const found = await repository.findByGithubRunId({ runId: 98765432 });

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.githubRunId).toBe(98765432);
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findByGithubRunId({ runId: 99999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('countByStatus', () => {
    it('should return counts grouped by status', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'running',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'completed',
      });
      await createExecution(db, {
        automationId: automation.id,
        status: 'failed',
      });

      const counts = await repository.countByStatus({ orgId: org.id });

      const countMap = new Map(counts.map((c) => [c.status, c.count]));
      expect(countMap.get('pending')).toBe(2);
      expect(countMap.get('running')).toBe(1);
      expect(countMap.get('completed')).toBe(1);
      expect(countMap.get('failed')).toBe(1);
    });

    it('should only count executions for the given org', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, {
        automationId: automation.id,
        status: 'pending',
      });

      // Create a second org with its own execution
      const otherOrg = await createOrg(db, {
        name: 'Other Org',
        slug: 'other-org-count',
      });
      const otherInstallation = await createInstallation(db, {
        orgId: otherOrg.id,
      });
      const otherRepo = await createRepository(db, {
        installationId: otherInstallation.id,
        orgId: otherOrg.id,
      });
      const otherUser = await createUser(db);
      const otherAutomation = await createAutomation(db, {
        orgId: otherOrg.id,
        repoId: otherRepo.id,
        createdBy: otherUser.id,
      });
      await createExecution(db, {
        automationId: otherAutomation.id,
        status: 'completed',
      });
      await createExecution(db, {
        automationId: otherAutomation.id,
        status: 'completed',
      });

      const counts = await repository.countByStatus({ orgId: org.id });

      const totalCount = counts.reduce((sum, c) => sum + c.count, 0);
      expect(totalCount).toBe(1);
      expect(counts).toHaveLength(1);
      expect(counts[0]).toEqual({ status: 'pending', count: 1 });
    });
  });

  describe('countActiveByOrgId', () => {
    it('should count active executions for an org', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id, status: 'pending' });
      await createExecution(db, { automationId: automation.id, status: 'running' });
      await createExecution(db, { automationId: automation.id, status: 'dispatching' });
      await createExecution(db, { automationId: automation.id, status: 'completed' });
      await createExecution(db, { automationId: automation.id, status: 'failed' });

      const count = await repository.countActiveByOrgId({ orgId: org.id });

      expect(count).toBe(3); // pending + running + dispatching
    });

    it('should return 0 when no active executions', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id, status: 'completed' });
      await createExecution(db, { automationId: automation.id, status: 'failed' });

      const count = await repository.countActiveByOrgId({ orgId: org.id });

      expect(count).toBe(0);
    });

    it('should only count executions for the given org', async () => {
      const { org, automation } = await seedAutomation();
      await createExecution(db, { automationId: automation.id, status: 'running' });

      const otherOrg = await createOrg(db, { name: 'Other', slug: 'other-active-count' });
      const otherInstallation = await createInstallation(db, { orgId: otherOrg.id });
      const otherRepo = await createRepository(db, {
        installationId: otherInstallation.id,
        orgId: otherOrg.id,
      });
      const otherUser = await createUser(db);
      const otherAutomation = await createAutomation(db, {
        orgId: otherOrg.id,
        repoId: otherRepo.id,
        createdBy: otherUser.id,
      });
      await createExecution(db, { automationId: otherAutomation.id, status: 'running' });

      const count = await repository.countActiveByOrgId({ orgId: org.id });

      expect(count).toBe(1);
    });
  });
});
