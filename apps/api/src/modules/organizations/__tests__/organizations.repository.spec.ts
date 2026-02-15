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
  createOrgMember,
  resetCounters,
} from '../../../database/test/factories';
import { OrganizationsRepository } from '../organizations.repository';

describe('OrganizationsRepository', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let repository: OrganizationsRepository;

  beforeEach(async () => {
    ({ db, client } = await createTestTransaction());
    repository = new OrganizationsRepository(db);
    resetCounters();
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('createOrg', () => {
    it('should create an organization', async () => {
      const org = await repository.createOrg({
        name: 'Acme Corp',
        slug: 'acme-corp',
      });

      expect(org).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp' });
      expect(org.id).toBeDefined();
      expect(org.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findOrgById', () => {
    it('should return the org when found', async () => {
      const created = await createOrg(db, {
        name: 'Found Org',
        slug: 'found-org',
      });

      const found = await repository.findOrgById({ id: created.id });

      expect(found).toMatchObject({ id: created.id, name: 'Found Org' });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findOrgById({ id: 999999 });

      expect(found).toBeUndefined();
    });
  });

  describe('findOrgBySlug', () => {
    it('should return the org when found', async () => {
      const created = await createOrg(db, {
        name: 'Slug Org',
        slug: 'slug-org',
      });

      const found = await repository.findOrgBySlug({ slug: 'slug-org' });

      expect(found).toMatchObject({
        id: created.id,
        name: 'Slug Org',
        slug: 'slug-org',
      });
    });

    it('should return undefined when not found', async () => {
      const found = await repository.findOrgBySlug({
        slug: 'nonexistent-slug',
      });

      expect(found).toBeUndefined();
    });
  });

  describe('findOrgsByUserId', () => {
    it('should return all orgs a user belongs to', async () => {
      const user = await createUser(db);
      const org1 = await createOrg(db, { name: 'Org One', slug: 'org-one' });
      const org2 = await createOrg(db, { name: 'Org Two', slug: 'org-two' });
      await createOrgMember(db, {
        orgId: org1.id,
        userId: user.id,
        role: 'owner',
      });
      await createOrgMember(db, {
        orgId: org2.id,
        userId: user.id,
        role: 'member',
      });

      const orgs = await repository.findOrgsByUserId({ userId: user.id });

      expect(orgs).toHaveLength(2);
      const slugs = orgs.map((o) => o.slug).sort();
      expect(slugs).toEqual(['org-one', 'org-two']);
    });

    it('should return empty array when user has no orgs', async () => {
      const user = await createUser(db);

      const orgs = await repository.findOrgsByUserId({ userId: user.id });

      expect(orgs).toEqual([]);
    });
  });

  describe('addMember', () => {
    it('should add a member with the specified role', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);

      const member = await repository.addMember({
        orgId: org.id,
        userId: user.id,
        role: 'admin',
      });

      expect(member).toMatchObject({
        orgId: org.id,
        userId: user.id,
        role: 'admin',
      });
      expect(member.joinedAt).toBeInstanceOf(Date);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from the org', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, { orgId: org.id, userId: user.id });

      await repository.removeMember({ orgId: org.id, userId: user.id });

      const role = await repository.getMemberRole({
        orgId: org.id,
        userId: user.id,
      });
      expect(role).toBeNull();
    });

    it('should not throw when member does not exist', async () => {
      await expect(
        repository.removeMember({ orgId: 999999, userId: 999999 }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getMemberRole', () => {
    it('should return the role when user is a member', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);
      await createOrgMember(db, {
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      });

      const role = await repository.getMemberRole({
        orgId: org.id,
        userId: user.id,
      });

      expect(role).toBe('owner');
    });

    it('should return null when user is not a member', async () => {
      const user = await createUser(db);
      const org = await createOrg(db);

      const role = await repository.getMemberRole({
        orgId: org.id,
        userId: user.id,
      });

      expect(role).toBeNull();
    });
  });

  describe('listMembers', () => {
    it('should return all members with user info', async () => {
      const user1 = await createUser(db, { username: 'alice' });
      const user2 = await createUser(db, { username: 'bob' });
      const org = await createOrg(db);
      await createOrgMember(db, {
        orgId: org.id,
        userId: user1.id,
        role: 'owner',
      });
      await createOrgMember(db, {
        orgId: org.id,
        userId: user2.id,
        role: 'member',
      });

      const members = await repository.listMembers({ orgId: org.id });

      expect(members).toHaveLength(2);
      const usernames = members.map((m) => m.username).sort();
      expect(usernames).toEqual(['alice', 'bob']);
      expect(members.find((m) => m.username === 'alice')?.role).toBe('owner');
    });

    it('should return empty array for org with no members', async () => {
      const org = await createOrg(db);

      const members = await repository.listMembers({ orgId: org.id });

      expect(members).toEqual([]);
    });
  });
});
