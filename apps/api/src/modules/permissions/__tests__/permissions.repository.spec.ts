import { PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  TestDatabase,
} from '../../../database/test/test-database';
import { createOrg, resetCounters } from '../../../database/test/factories';
import { PermissionsRepository } from '../permissions.repository';
import { Permission } from '../permissions.constants';

describe('PermissionsRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: PermissionsRepository;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());
    repository = new PermissionsRepository(
      db as unknown as ConstructorParameters<typeof PermissionsRepository>[0],
    );
    Object.defineProperty(repository, 'db', { value: db, writable: false });
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('findByOrgAndRole', () => {
    it('should return undefined when no override exists', async () => {
      const org = await createOrg(db);

      const result = await repository.findByOrgAndRole({
        orgId: org.id,
        role: 'admin',
      });

      expect(result).toBeUndefined();
    });

    it('should return the override when it exists', async () => {
      const org = await createOrg(db);
      const permissions = [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW];

      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions,
      });

      const result = await repository.findByOrgAndRole({
        orgId: org.id,
        role: 'admin',
      });

      expect(result).toBeDefined();
      expect(result?.permissions).toEqual(permissions);
      expect(result?.role).toBe('admin');
    });

    it('should not return overrides for different role', async () => {
      const org = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });

      const result = await repository.findByOrgAndRole({
        orgId: org.id,
        role: 'member',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('findAllByOrg', () => {
    it('should return empty array when no overrides exist', async () => {
      const org = await createOrg(db);

      const result = await repository.findAllByOrg({ orgId: org.id });

      expect(result).toEqual([]);
    });

    it('should return all overrides for the org', async () => {
      const org = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });
      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'member',
        permissions: [Permission.EXECUTIONS_VIEW],
      });

      const result = await repository.findAllByOrg({ orgId: org.id });

      expect(result).toHaveLength(2);
    });

    it('should not return overrides from other orgs', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org1.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });
      await repository.upsertForOrgAndRole({
        orgId: org2.id,
        role: 'admin',
        permissions: [Permission.EXECUTIONS_VIEW],
      });

      const result = await repository.findAllByOrg({ orgId: org1.id });

      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe(org1.id);
    });
  });

  describe('upsertForOrgAndRole', () => {
    it('should create a new override', async () => {
      const org = await createOrg(db);
      const permissions = [Permission.AUTOMATIONS_VIEW];

      const result = await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions,
      });

      expect(result.id).toBeDefined();
      expect(result.orgId).toBe(org.id);
      expect(result.role).toBe('admin');
      expect(result.permissions).toEqual(permissions);
    });

    it('should update existing override on conflict', async () => {
      const org = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });

      const updated = await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW, Permission.AUTOMATIONS_CREATE],
      });

      expect(updated.permissions).toEqual([
        Permission.AUTOMATIONS_VIEW,
        Permission.AUTOMATIONS_CREATE,
      ]);

      const all = await repository.findAllByOrg({ orgId: org.id });
      expect(all).toHaveLength(1);
    });
  });

  describe('deleteByOrg', () => {
    it('should delete all overrides for the org', async () => {
      const org = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });
      await repository.upsertForOrgAndRole({
        orgId: org.id,
        role: 'member',
        permissions: [Permission.EXECUTIONS_VIEW],
      });

      await repository.deleteByOrg({ orgId: org.id });

      const result = await repository.findAllByOrg({ orgId: org.id });
      expect(result).toEqual([]);
    });

    it('should not delete overrides from other orgs', async () => {
      const org1 = await createOrg(db);
      const org2 = await createOrg(db);

      await repository.upsertForOrgAndRole({
        orgId: org1.id,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });
      await repository.upsertForOrgAndRole({
        orgId: org2.id,
        role: 'admin',
        permissions: [Permission.EXECUTIONS_VIEW],
      });

      await repository.deleteByOrg({ orgId: org1.id });

      const remaining = await repository.findAllByOrg({ orgId: org2.id });
      expect(remaining).toHaveLength(1);
    });
  });
});
