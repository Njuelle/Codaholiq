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
  createAuditLog,
  resetCounters,
} from '../../../database/test/factories';
import { AuditRepository } from '../audit.repository';

describe('AuditRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: AuditRepository;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());
    repository = new AuditRepository(
      db as unknown as ConstructorParameters<typeof AuditRepository>[0],
    );
    // Inject using symbol
    Object.defineProperty(repository, 'db', { value: db, writable: false });
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('create', () => {
    it('should create an audit log entry', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, { orgId: org.id, userId: user.id, role: 'owner' });

      const result = await repository.create({
        orgId: org.id,
        userId: user.id,
        action: 'automation.created',
        resourceType: 'automation',
        resourceId: '42',
        details: { name: 'Test Automation' },
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      });

      expect(result.id).toBeDefined();
      expect(result.orgId).toBe(org.id);
      expect(result.userId).toBe(user.id);
      expect(result.action).toBe('automation.created');
      expect(result.resourceType).toBe('automation');
      expect(result.resourceId).toBe('42');
      expect(result.details).toEqual({ name: 'Test Automation' });
      expect(result.ipAddress).toBe('127.0.0.1');
      expect(result.userAgent).toBe('TestAgent/1.0');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create an audit log with null optional fields', async () => {
      const result = await repository.create({
        action: 'auth.login',
        resourceType: 'session',
      });

      expect(result.orgId).toBeNull();
      expect(result.userId).toBeNull();
      expect(result.resourceId).toBeNull();
      expect(result.details).toBeNull();
    });
  });

  describe('findByOrgId', () => {
    it('should return audit logs for an org ordered by createdAt desc', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, { orgId: org.id, userId: user.id, role: 'owner' });

      await createAuditLog(db, {
        orgId: org.id,
        userId: user.id,
        action: 'automation.created',
        resourceType: 'automation',
        resourceId: '1',
      });
      await createAuditLog(db, {
        orgId: org.id,
        userId: user.id,
        action: 'automation.updated',
        resourceType: 'automation',
        resourceId: '1',
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        limit: 50,
        offset: 0,
      });

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('automation.updated');
      expect(results[1].action).toBe('automation.created');
    });

    it('should filter by action', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, { orgId: org.id, userId: user.id, role: 'owner' });

      await createAuditLog(db, {
        orgId: org.id,
        userId: user.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org.id,
        userId: user.id,
        action: 'automation.deleted',
        resourceType: 'automation',
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        action: 'automation.created',
        limit: 50,
        offset: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('automation.created');
    });

    it('should filter by userId', async () => {
      const user1 = await createUser(db);
      const user2 = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, { orgId: org.id, userId: user1.id, role: 'owner' });
      await createOrgMember(db, { orgId: org.id, userId: user2.id, role: 'member' });

      await createAuditLog(db, {
        orgId: org.id,
        userId: user1.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org.id,
        userId: user2.id,
        action: 'automation.updated',
        resourceType: 'automation',
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        userId: user1.id,
        limit: 50,
        offset: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(user1.id);
    });

    it('should filter by resourceType', async () => {
      const org = await createOrg(db);

      await createAuditLog(db, {
        orgId: org.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org.id,
        action: 'member.invited',
        resourceType: 'member',
      });

      const results = await repository.findByOrgId({
        orgId: org.id,
        resourceType: 'member',
        limit: 50,
        offset: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].resourceType).toBe('member');
    });

    it('should support pagination', async () => {
      const org = await createOrg(db);

      for (let i = 0; i < 5; i++) {
        await createAuditLog(db, {
          orgId: org.id,
          action: 'automation.created',
          resourceType: 'automation',
          resourceId: String(i),
        });
      }

      const page1 = await repository.findByOrgId({
        orgId: org.id,
        limit: 2,
        offset: 0,
      });
      const page2 = await repository.findByOrgId({
        orgId: org.id,
        limit: 2,
        offset: 2,
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should not return logs from other orgs', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);

      await createAuditLog(db, {
        orgId: org1.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org2.id,
        action: 'automation.created',
        resourceType: 'automation',
      });

      const results = await repository.findByOrgId({
        orgId: org1.id,
        limit: 50,
        offset: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].orgId).toBe(org1.id);
    });
  });

  describe('countByOrgId', () => {
    it('should return the total count for an org', async () => {
      const org = await createOrg(db);

      await createAuditLog(db, {
        orgId: org.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org.id,
        action: 'automation.updated',
        resourceType: 'automation',
      });

      const total = await repository.countByOrgId({ orgId: org.id });

      expect(total).toBe(2);
    });

    it('should apply filters to count', async () => {
      const org = await createOrg(db);

      await createAuditLog(db, {
        orgId: org.id,
        action: 'automation.created',
        resourceType: 'automation',
      });
      await createAuditLog(db, {
        orgId: org.id,
        action: 'member.invited',
        resourceType: 'member',
      });

      const total = await repository.countByOrgId({
        orgId: org.id,
        action: 'automation.created',
      });

      expect(total).toBe(1);
    });
  });
});
