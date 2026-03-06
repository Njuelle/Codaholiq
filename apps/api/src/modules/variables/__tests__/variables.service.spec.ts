import { NotFoundException, ConflictException } from '@nestjs/common';
import { VariablesService } from '../variables.service';
import { VariablesRepository } from '../variables.repository';
import { GitHubEntityRepository } from '../../github/github-entity.repository';
import { SanitizationService } from '../../../common/sanitization/sanitization.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';

function createMockVariablesRepository() {
  return {
    findByOrgId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findForResolution: vi.fn(),
  };
}

function createMockGitHubEntityRepository() {
  return {
    findRepositoryById: vi.fn(),
  };
}

function createMockSanitizationService() {
  return {
    sanitizeForStorage: vi.fn().mockImplementation(({ input }: { input: string }) => input),
  };
}

function createMockEncryptionService() {
  return {
    encrypt: vi
      .fn()
      .mockImplementation(({ plaintext }: { plaintext: string }) => `enc:${plaintext}`),
    decrypt: vi
      .fn()
      .mockImplementation(({ encrypted }: { encrypted: string }) => encrypted.replace('enc:', '')),
  };
}

function makeVariable(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: null,
    key: 'api_key',
    value: 'test-value',
    isSecret: false,
    description: 'Test description',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    githubId: 12345,
    installationId: 1,
    orgId: 10,
    owner: 'octocat',
    name: 'hello-world',
    fullName: 'octocat/hello-world',
    defaultBranch: 'main',
    private: false,
    language: 'TypeScript',
    archived: false,
    webhookActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('VariablesService', () => {
  let service: VariablesService;
  let variablesRepo: ReturnType<typeof createMockVariablesRepository>;
  let githubRepo: ReturnType<typeof createMockGitHubEntityRepository>;
  let sanitizationService: ReturnType<typeof createMockSanitizationService>;
  let encryptionService: ReturnType<typeof createMockEncryptionService>;

  beforeEach(() => {
    variablesRepo = createMockVariablesRepository();
    githubRepo = createMockGitHubEntityRepository();
    sanitizationService = createMockSanitizationService();
    encryptionService = createMockEncryptionService();

    service = new VariablesService(
      variablesRepo as unknown as VariablesRepository,
      githubRepo as unknown as GitHubEntityRepository,
      sanitizationService as unknown as SanitizationService,
      encryptionService as unknown as EncryptionService,
    );
  });

  describe('list', () => {
    it('should return variables with secret values masked', async () => {
      const variables = [
        makeVariable(),
        makeVariable({ id: 2, key: 'db_url', isSecret: true, value: 'enc:secret-db-url' }),
      ];
      variablesRepo.findByOrgId.mockResolvedValue(variables);

      const result = await service.list({ orgId: 10 });

      expect(result[0].value).toBe('test-value');
      expect(result[1].value).toBe('••••••••');
      expect(variablesRepo.findByOrgId).toHaveBeenCalledWith({ orgId: 10 });
    });

    it('should not mask non-secret variables', async () => {
      const variables = [makeVariable()];
      variablesRepo.findByOrgId.mockResolvedValue(variables);

      const result = await service.list({ orgId: 10 });

      expect(result[0].value).toBe('test-value');
    });
  });

  describe('create', () => {
    const orgWideDto = {
      key: 'api_key',
      value: 'test-value',
      isSecret: false,
      description: 'Test description',
    };

    const repoScopedDto = {
      key: 'api_key',
      value: 'test-value',
      isSecret: false,
      description: 'Test description',
      repoId: 100,
    };

    it('should create org-wide variable (no repoId)', async () => {
      const created = makeVariable();
      variablesRepo.create.mockResolvedValue(created);

      const result = await service.create({ orgId: 10, dto: orgWideDto });

      expect(result).toEqual(created);
      expect(githubRepo.findRepositoryById).not.toHaveBeenCalled();
      expect(variablesRepo.create).toHaveBeenCalledWith({
        orgId: 10,
        repoId: null,
        key: 'api_key',
        value: 'test-value',
        isSecret: false,
        description: 'Test description',
      });
    });

    it('should encrypt value when isSecret is true', async () => {
      const created = makeVariable({ isSecret: true, value: 'enc:my-secret' });
      variablesRepo.create.mockResolvedValue(created);

      const result = await service.create({
        orgId: 10,
        dto: { key: 'secret_key', value: 'my-secret', isSecret: true },
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith({ plaintext: 'my-secret' });
      expect(variablesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'enc:my-secret', isSecret: true }),
      );
      expect(result.value).toBe('••••••••');
    });

    it('should not encrypt value when isSecret is false', async () => {
      const created = makeVariable();
      variablesRepo.create.mockResolvedValue(created);

      await service.create({ orgId: 10, dto: orgWideDto });

      expect(encryptionService.encrypt).not.toHaveBeenCalled();
      expect(variablesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'test-value' }),
      );
    });

    it('should create repo-scoped variable after validating repo', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const created = makeVariable({ repoId: 100 });
      variablesRepo.create.mockResolvedValue(created);

      const result = await service.create({ orgId: 10, dto: repoScopedDto });

      expect(result).toEqual(created);
      expect(githubRepo.findRepositoryById).toHaveBeenCalledWith({ id: 100 });
      expect(variablesRepo.create).toHaveBeenCalledWith({
        orgId: 10,
        repoId: 100,
        key: 'api_key',
        value: 'test-value',
        isSecret: false,
        description: 'Test description',
      });
    });

    it('should throw NotFoundException when repoId does not exist', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(service.create({ orgId: 10, dto: repoScopedDto })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when repo belongs to different org', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo({ orgId: 99 }));

      await expect(service.create({ orgId: 10, dto: repoScopedDto })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on duplicate key (unique constraint error)', async () => {
      variablesRepo.create.mockRejectedValue(
        new Error('duplicate key value violates unique constraint'),
      );

      await expect(service.create({ orgId: 10, dto: orgWideDto })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should sanitize key, value, and description', async () => {
      const created = makeVariable();
      variablesRepo.create.mockResolvedValue(created);

      await service.create({ orgId: 10, dto: orgWideDto });

      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledWith({
        input: 'api_key',
        maxLength: 100,
      });
      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledWith({
        input: 'test-value',
        maxLength: 10000,
      });
      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledWith({
        input: 'Test description',
        maxLength: 500,
      });
    });

    it('should not sanitize description when not provided', async () => {
      const created = makeVariable({ description: null });
      variablesRepo.create.mockResolvedValue(created);

      await service.create({
        orgId: 10,
        dto: { key: 'api_key', value: 'test-value', isSecret: false },
      });

      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledTimes(2);
      expect(variablesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined }),
      );
    });

    it('should re-throw non-unique constraint errors', async () => {
      const dbError = new Error('connection refused');
      variablesRepo.create.mockRejectedValue(dbError);

      await expect(service.create({ orgId: 10, dto: orgWideDto })).rejects.toThrow(
        'connection refused',
      );
      await expect(service.create({ orgId: 10, dto: orgWideDto })).rejects.not.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update variable and return result', async () => {
      const existing = makeVariable();
      variablesRepo.findById.mockResolvedValue(existing);
      const updated = makeVariable({ value: 'new-value' });
      variablesRepo.update.mockResolvedValue(updated);

      const result = await service.update({
        orgId: 10,
        variableId: 1,
        dto: { value: 'new-value' },
      });

      expect(result).toEqual(updated);
      expect(variablesRepo.update).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
        data: { value: 'new-value' },
      });
    });

    it('should encrypt value when updating a secret variable', async () => {
      const existing = makeVariable({ isSecret: true });
      variablesRepo.findById.mockResolvedValue(existing);
      const updated = makeVariable({ isSecret: true, value: 'enc:new-secret' });
      variablesRepo.update.mockResolvedValue(updated);

      const result = await service.update({
        orgId: 10,
        variableId: 1,
        dto: { value: 'new-secret' },
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith({ plaintext: 'new-secret' });
      expect(variablesRepo.update).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
        data: { value: 'enc:new-secret' },
      });
      expect(result.value).toBe('••••••••');
    });

    it('should not encrypt value when updating a non-secret variable', async () => {
      const existing = makeVariable({ isSecret: false });
      variablesRepo.findById.mockResolvedValue(existing);
      const updated = makeVariable({ value: 'new-value' });
      variablesRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        variableId: 1,
        dto: { value: 'new-value' },
      });

      expect(encryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when variable not found for update', async () => {
      variablesRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.update({
          orgId: 10,
          variableId: 999,
          dto: { value: 'new-value' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when repository update returns undefined', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());
      variablesRepo.update.mockResolvedValue(undefined);

      await expect(
        service.update({
          orgId: 10,
          variableId: 1,
          dto: { value: 'new-value' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should sanitize value when provided', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());
      const updated = makeVariable({ value: 'sanitized' });
      variablesRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        variableId: 1,
        dto: { value: 'raw-value' },
      });

      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledWith({
        input: 'raw-value',
        maxLength: 10000,
      });
    });

    it('should sanitize description when provided as string', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());
      const updated = makeVariable({ description: 'new desc' });
      variablesRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        variableId: 1,
        dto: { description: 'new desc' },
      });

      expect(sanitizationService.sanitizeForStorage).toHaveBeenCalledWith({
        input: 'new desc',
        maxLength: 500,
      });
    });

    it('should pass null description without sanitization', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());
      const updated = makeVariable({ description: null });
      variablesRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        variableId: 1,
        dto: { description: null },
      });

      expect(sanitizationService.sanitizeForStorage).not.toHaveBeenCalled();
      expect(variablesRepo.update).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
        data: { description: null },
      });
    });

    it('should not include fields that are not in dto', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());
      const updated = makeVariable();
      variablesRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        variableId: 1,
        dto: {},
      });

      expect(variablesRepo.update).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
        data: {},
      });
    });
  });

  describe('delete', () => {
    it('should delete existing variable', async () => {
      variablesRepo.findById.mockResolvedValue(makeVariable());

      await service.delete({ orgId: 10, variableId: 1 });

      expect(variablesRepo.findById).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
      });
      expect(variablesRepo.delete).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
      });
    });

    it('should throw NotFoundException when variable not found', async () => {
      variablesRepo.findById.mockResolvedValue(undefined);

      await expect(service.delete({ orgId: 10, variableId: 999 })).rejects.toThrow(
        NotFoundException,
      );
      expect(variablesRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findForResolution', () => {
    it('should return variables with non-secret values as-is', async () => {
      const variables = [makeVariable(), makeVariable({ id: 2, key: 'db_url', repoId: 100 })];
      variablesRepo.findForResolution.mockResolvedValue(variables);

      const result = await service.findForResolution({
        orgId: 10,
        repoId: 100,
      });

      expect(result).toEqual(variables);
      expect(encryptionService.decrypt).not.toHaveBeenCalled();
      expect(variablesRepo.findForResolution).toHaveBeenCalledWith({
        orgId: 10,
        repoId: 100,
      });
    });

    it('should decrypt secret variable values for prompt resolution', async () => {
      const variables = [
        makeVariable(),
        makeVariable({ id: 2, key: 'secret_token', isSecret: true, value: 'enc:real-token' }),
      ];
      variablesRepo.findForResolution.mockResolvedValue(variables);

      const result = await service.findForResolution({
        orgId: 10,
        repoId: 100,
      });

      expect(result[0].value).toBe('test-value');
      expect(result[1].value).toBe('real-token');
      expect(encryptionService.decrypt).toHaveBeenCalledWith({ encrypted: 'enc:real-token' });
    });
  });
});
