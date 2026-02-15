import { PoolClient } from 'pg';
import {
  createTestTransaction,
  rollbackTestTransaction,
  closeTestDb,
  TestDatabase,
} from '../test/test-database';
import {
  createUser,
  createOrg,
  createOrgMember,
  createInstallation,
  createRepository,
  createAutomation,
  createExecution,
  createAuditLog,
  resetCounters,
} from '../test/factories';
import { AutomationRepository } from '../../modules/automations/automations.repository';
import { GitHubEntityRepository } from '../../modules/github/github-entity.repository';
import { ExecutionRepository } from '../../modules/executions/executions.repository';
import { OrganizationsRepository } from '../../modules/organizations/organizations.repository';
import { AuditRepository } from '../../modules/audit/audit.repository';

/**
 * Cross-org isolation security test.
 *
 * Seeds data in two separate orgs (A and B) and verifies that every
 * org-scoped repository query path returns only the correct org's data.
 */
describe('Cross-org data isolation', () => {
  let db: TestDatabase;
  let client: PoolClient;

  // Repositories under test
  let automationRepo: AutomationRepository;
  let githubRepo: GitHubEntityRepository;
  let executionRepo: ExecutionRepository;
  let orgRepo: OrganizationsRepository;
  let auditRepo: AuditRepository;

  // Seeded data references
  let orgA: Awaited<ReturnType<typeof createOrg>>;
  let orgB: Awaited<ReturnType<typeof createOrg>>;
  let userA: Awaited<ReturnType<typeof createUser>>;
  let userB: Awaited<ReturnType<typeof createUser>>;
  let repoA: Awaited<ReturnType<typeof createRepository>>;
  let repoB: Awaited<ReturnType<typeof createRepository>>;
  let automationA: Awaited<ReturnType<typeof createAutomation>>;
  let automationB: Awaited<ReturnType<typeof createAutomation>>;
  let executionA: Awaited<ReturnType<typeof createExecution>>;
  let executionB: Awaited<ReturnType<typeof createExecution>>;

  beforeEach(async () => {
    resetCounters();
    ({ db, client } = await createTestTransaction());

    // Wire up repositories with the test DB using Object.create to bypass
    // complex constructors (ConfigService, etc.)
    automationRepo = Object.create(AutomationRepository.prototype);
    Object.defineProperty(automationRepo, 'db', { value: db, writable: false });

    githubRepo = Object.create(GitHubEntityRepository.prototype);
    Object.defineProperty(githubRepo, 'db', { value: db, writable: false });

    executionRepo = Object.create(ExecutionRepository.prototype);
    Object.defineProperty(executionRepo, 'db', { value: db, writable: false });

    orgRepo = Object.create(OrganizationsRepository.prototype);
    Object.defineProperty(orgRepo, 'db', { value: db, writable: false });

    auditRepo = Object.create(AuditRepository.prototype);
    Object.defineProperty(auditRepo, 'db', { value: db, writable: false });

    // --- Seed Org A ---
    userA = await createUser(db, { username: 'user-a', githubId: 1001 });
    orgA = await createOrg(db, { name: 'Org A', slug: 'org-a' });
    await createOrgMember(db, { orgId: orgA.id, userId: userA.id, role: 'owner' });

    const installA = await createInstallation(db, {
      orgId: orgA.id,
      accountLogin: 'org-a-account',
    });
    repoA = await createRepository(db, {
      orgId: orgA.id,
      installationId: installA.id,
      owner: 'org-a-account',
      name: 'repo-a',
    });
    automationA = await createAutomation(db, {
      orgId: orgA.id,
      repoId: repoA.id,
      createdBy: userA.id,
      name: 'Automation A',
    });
    executionA = await createExecution(db, {
      automationId: automationA.id,
      status: 'completed',
    });

    await createAuditLog(db, {
      orgId: orgA.id,
      userId: userA.id,
      action: 'automation.created',
      resourceType: 'automation',
      resourceId: String(automationA.id),
    });

    // --- Seed Org B ---
    userB = await createUser(db, { username: 'user-b', githubId: 1002 });
    orgB = await createOrg(db, { name: 'Org B', slug: 'org-b' });
    await createOrgMember(db, { orgId: orgB.id, userId: userB.id, role: 'owner' });

    const installB = await createInstallation(db, {
      orgId: orgB.id,
      accountLogin: 'org-b-account',
    });
    repoB = await createRepository(db, {
      orgId: orgB.id,
      installationId: installB.id,
      owner: 'org-b-account',
      name: 'repo-b',
    });
    automationB = await createAutomation(db, {
      orgId: orgB.id,
      repoId: repoB.id,
      createdBy: userB.id,
      name: 'Automation B',
    });
    executionB = await createExecution(db, {
      automationId: automationB.id,
      status: 'running',
    });

    await createAuditLog(db, {
      orgId: orgB.id,
      userId: userB.id,
      action: 'automation.created',
      resourceType: 'automation',
      resourceId: String(automationB.id),
    });
  });

  afterEach(async () => {
    await rollbackTestTransaction(client);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('AutomationRepository', () => {
    it('findByOrgId should only return automations for the queried org', async () => {
      const orgAResults = await automationRepo.findByOrgId({ orgId: orgA.id });
      const orgBResults = await automationRepo.findByOrgId({ orgId: orgB.id });

      expect(orgAResults).toHaveLength(1);
      expect(orgAResults[0].name).toBe('Automation A');

      expect(orgBResults).toHaveLength(1);
      expect(orgBResults[0].name).toBe('Automation B');
    });

    it('findById with orgId should not return another org automation', async () => {
      const result = await automationRepo.findById({
        id: automationB.id,
        orgId: orgA.id,
      });

      expect(result).toBeUndefined();
    });

    it('update should not modify another org automation', async () => {
      const updated = await automationRepo.update({
        id: automationB.id,
        orgId: orgA.id,
        data: { name: 'Hacked' },
      });

      expect(updated).toBeUndefined();

      // Verify B's automation is unchanged
      const original = await automationRepo.findById({
        id: automationB.id,
        orgId: orgB.id,
      });
      expect(original?.name).toBe('Automation B');
    });

    it('delete should not remove another org automation', async () => {
      const deleted = await automationRepo.delete({
        id: automationB.id,
        orgId: orgA.id,
      });

      expect(deleted).toBeUndefined();

      // Verify B's automation still exists
      const still = await automationRepo.findById({
        id: automationB.id,
        orgId: orgB.id,
      });
      expect(still).toBeDefined();
    });

    it('setEnabled should not toggle another org automation', async () => {
      const toggled = await automationRepo.setEnabled({
        id: automationB.id,
        orgId: orgA.id,
        enabled: false,
      });

      expect(toggled).toBeUndefined();

      // Verify B's automation is still enabled
      const original = await automationRepo.findById({
        id: automationB.id,
        orgId: orgB.id,
      });
      expect(original?.enabled).toBe(true);
    });

    it('countByOrgId should only count the queried org automations', async () => {
      const countA = await automationRepo.countByOrgId({ orgId: orgA.id });
      const countB = await automationRepo.countByOrgId({ orgId: orgB.id });

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  describe('GitHubEntityRepository', () => {
    it('findRepositoriesByOrgId should only return repos for the queried org', async () => {
      const orgARepos = await githubRepo.findRepositoriesByOrgId({ orgId: orgA.id });
      const orgBRepos = await githubRepo.findRepositoriesByOrgId({ orgId: orgB.id });

      expect(orgARepos).toHaveLength(1);
      expect(orgARepos[0].name).toBe('repo-a');

      expect(orgBRepos).toHaveLength(1);
      expect(orgBRepos[0].name).toBe('repo-b');
    });

    it('findRepositoryByFullName should not return another org repo with same name', async () => {
      const result = await githubRepo.findRepositoryByFullName({
        fullName: `org-b-account/repo-b`,
        orgId: orgA.id,
      });

      expect(result).toBeUndefined();
    });

    it('findInstallationByOrgId should only return the queried org installation', async () => {
      const installA = await githubRepo.findInstallationByOrgId({ orgId: orgA.id });
      const installB = await githubRepo.findInstallationByOrgId({ orgId: orgB.id });

      expect(installA?.accountLogin).toBe('org-a-account');
      expect(installB?.accountLogin).toBe('org-b-account');
    });

    it('countByOrgId should only count the queried org repos', async () => {
      const countA = await githubRepo.countByOrgId({ orgId: orgA.id });
      const countB = await githubRepo.countByOrgId({ orgId: orgB.id });

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  describe('ExecutionRepository', () => {
    it('findByOrgId should only return executions for the queried org', async () => {
      const orgAExecs = await executionRepo.findByOrgId({ orgId: orgA.id });
      const orgBExecs = await executionRepo.findByOrgId({ orgId: orgB.id });

      expect(orgAExecs).toHaveLength(1);
      expect(orgAExecs[0].execution.id).toBe(executionA.id);

      expect(orgBExecs).toHaveLength(1);
      expect(orgBExecs[0].execution.id).toBe(executionB.id);
    });

    it('countByOrgId should only count the queried org executions', async () => {
      const countA = await executionRepo.countByOrgId({ orgId: orgA.id });
      const countB = await executionRepo.countByOrgId({ orgId: orgB.id });

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it('countByStatus should only count the queried org statuses', async () => {
      const statusA = await executionRepo.countByStatus({ orgId: orgA.id });
      const statusB = await executionRepo.countByStatus({ orgId: orgB.id });

      // Org A has 1 completed execution
      expect(statusA.find((s) => s.status === 'completed')?.count).toBe(1);
      expect(statusA.find((s) => s.status === 'running')?.count).toBeUndefined();

      // Org B has 1 running execution
      expect(statusB.find((s) => s.status === 'running')?.count).toBe(1);
      expect(statusB.find((s) => s.status === 'completed')?.count).toBeUndefined();
    });
  });

  describe('OrganizationsRepository', () => {
    it('listMembers should only return members for the queried org', async () => {
      const membersA = await orgRepo.listMembers({ orgId: orgA.id });
      const membersB = await orgRepo.listMembers({ orgId: orgB.id });

      expect(membersA).toHaveLength(1);
      expect(membersA[0].userId).toBe(userA.id);

      expect(membersB).toHaveLength(1);
      expect(membersB[0].userId).toBe(userB.id);
    });

    it('getMemberRole should return null for a user not in the org', async () => {
      // User A is not a member of Org B
      const role = await orgRepo.getMemberRole({
        orgId: orgB.id,
        userId: userA.id,
      });

      expect(role).toBeNull();
    });

    it('countMembers should only count the queried org members', async () => {
      const countA = await orgRepo.countMembers({ orgId: orgA.id });
      const countB = await orgRepo.countMembers({ orgId: orgB.id });

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  describe('AuditRepository', () => {
    it('findByOrgId should only return audit logs for the queried org', async () => {
      const logsA = await auditRepo.findByOrgId({
        orgId: orgA.id,
        limit: 50,
        offset: 0,
      });
      const logsB = await auditRepo.findByOrgId({
        orgId: orgB.id,
        limit: 50,
        offset: 0,
      });

      expect(logsA).toHaveLength(1);
      expect(logsA[0].userId).toBe(userA.id);

      expect(logsB).toHaveLength(1);
      expect(logsB[0].userId).toBe(userB.id);
    });

    it('countByOrgId should only count the queried org audit logs', async () => {
      const countA = await auditRepo.countByOrgId({ orgId: orgA.id });
      const countB = await auditRepo.countByOrgId({ orgId: orgB.id });

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });
});
