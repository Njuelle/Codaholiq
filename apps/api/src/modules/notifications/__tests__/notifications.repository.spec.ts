import { PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  TestDatabase,
} from '../../../database/test/test-database';
import {
  createUser,
  createOrg,
  createOrgMember,
  createInstallation,
  createRepository,
  createAutomation,
  createExecution,
  createNotification,
  resetCounters,
} from '../../../database/test/factories';
import { NotificationRepository } from '../notifications.repository';

describe('NotificationRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: NotificationRepository;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());
    repository = new NotificationRepository(
      db as unknown as ConstructorParameters<typeof NotificationRepository>[0],
    );
    Object.defineProperty(repository, 'db', { value: db, writable: false });
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function seedOrgWithExecution(): Promise<{
    orgId: number;
    executionId: number;
  }> {
    const user = await createUser(db);
    const org = await createOrg(db);
    await createOrgMember(db, { orgId: org.id, userId: user.id, role: 'owner' });
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
    const execution = await createExecution(db, {
      automationId: automation.id,
      status: 'failed',
    });
    return { orgId: org.id, executionId: execution.id };
  }

  describe('create', () => {
    it('should create a notification', async () => {
      const { orgId, executionId } = await seedOrgWithExecution();

      const result = await repository.create({
        orgId,
        executionId,
        automationName: 'My Automation',
        message: 'Execution #1 of "My Automation" failed',
      });

      expect(result.id).toBeDefined();
      expect(result.orgId).toBe(orgId);
      expect(result.executionId).toBe(executionId);
      expect(result.automationName).toBe('My Automation');
      expect(result.message).toBe('Execution #1 of "My Automation" failed');
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findByOrgId', () => {
    it('should return notifications ordered by createdAt desc', async () => {
      const { orgId, executionId } = await seedOrgWithExecution();

      await createNotification(db, {
        orgId,
        executionId,
        automationName: 'First',
        message: 'First failure',
      });
      await createNotification(db, {
        orgId,
        executionId,
        automationName: 'Second',
        message: 'Second failure',
      });

      const results = await repository.findByOrgId({ orgId });

      expect(results).toHaveLength(2);
      expect(results[0].automationName).toBe('Second');
      expect(results[1].automationName).toBe('First');
    });

    it('should respect limit', async () => {
      const { orgId, executionId } = await seedOrgWithExecution();

      for (let i = 0; i < 5; i++) {
        await createNotification(db, { orgId, executionId });
      }

      const results = await repository.findByOrgId({ orgId, limit: 3 });

      expect(results).toHaveLength(3);
    });

    it('should not return notifications from other orgs', async () => {
      const { orgId: orgId1, executionId: execId1 } = await seedOrgWithExecution();
      const { orgId: orgId2, executionId: execId2 } = await seedOrgWithExecution();

      await createNotification(db, { orgId: orgId1, executionId: execId1 });
      await createNotification(db, { orgId: orgId2, executionId: execId2 });

      const results = await repository.findByOrgId({ orgId: orgId1 });

      expect(results).toHaveLength(1);
      expect(results[0].orgId).toBe(orgId1);
    });
  });

  describe('deleteById', () => {
    it('should delete a notification and return true', async () => {
      const { orgId, executionId } = await seedOrgWithExecution();
      const notification = await createNotification(db, {
        orgId,
        executionId,
      });

      const deleted = await repository.deleteById({
        id: notification.id,
        orgId,
      });

      expect(deleted).toBe(true);

      const remaining = await repository.findByOrgId({ orgId });
      expect(remaining).toHaveLength(0);
    });

    it('should return false when notification does not exist', async () => {
      const { orgId } = await seedOrgWithExecution();

      const deleted = await repository.deleteById({ id: 99999, orgId });

      expect(deleted).toBe(false);
    });

    it('should not delete notification from another org', async () => {
      const { orgId: orgId1, executionId: execId1 } = await seedOrgWithExecution();
      const { orgId: orgId2 } = await seedOrgWithExecution();

      const notification = await createNotification(db, {
        orgId: orgId1,
        executionId: execId1,
      });

      const deleted = await repository.deleteById({
        id: notification.id,
        orgId: orgId2,
      });

      expect(deleted).toBe(false);

      const remaining = await repository.findByOrgId({ orgId: orgId1 });
      expect(remaining).toHaveLength(1);
    });
  });

  describe('countByOrgId', () => {
    it('should return the count of notifications for an org', async () => {
      const { orgId, executionId } = await seedOrgWithExecution();

      await createNotification(db, { orgId, executionId });
      await createNotification(db, { orgId, executionId });

      const total = await repository.countByOrgId({ orgId });

      expect(total).toBe(2);
    });

    it('should return 0 when no notifications exist', async () => {
      const { orgId } = await seedOrgWithExecution();

      const total = await repository.countByOrgId({ orgId });

      expect(total).toBe(0);
    });
  });
});
