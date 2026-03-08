import { BadRequestException } from '@nestjs/common';
import { ModelPoliciesService } from '../model-policies.service';
import type { ModelPoliciesRepository } from '../model-policies.repository';
import type { ProvidersRegistry } from '../../providers/providers.registry';

function createMockRepository() {
  return {
    findByRepoId: vi.fn(),
    setForRepo: vi.fn(),
    isModelAllowed: vi.fn(),
  };
}

function createMockProvidersRegistry() {
  return {
    getById: vi.fn(),
    getByIdOrThrow: vi.fn(),
    validateModel: vi.fn(),
    getAll: vi.fn(),
    getDefault: vi.fn(),
    getProviderIds: vi.fn(),
    getModelsForProvider: vi.fn(),
    mapDispatchInputs: vi.fn(),
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: 100,
    provider: 'claude-code',
    model: 'claude-sonnet-4-5-20250929',
    createdAt: new Date(),
    createdBy: 1,
    ...overrides,
  };
}

describe('ModelPoliciesService', () => {
  let service: ModelPoliciesService;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockRegistry: ReturnType<typeof createMockProvidersRegistry>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    mockRegistry = createMockProvidersRegistry();
    service = new ModelPoliciesService(
      mockRepo as unknown as ModelPoliciesRepository,
      mockRegistry as unknown as ProvidersRegistry,
    );
  });

  describe('getForRepo', () => {
    it('should return unrestricted when no policies exist', async () => {
      mockRepo.findByRepoId.mockResolvedValue([]);

      const result = await service.getForRepo({ orgId: 10, repoId: 100 });

      expect(result.isRestricted).toBe(false);
      expect(result.policies).toEqual([]);
    });

    it('should return restricted when policies exist', async () => {
      const policies = [makePolicy()];
      mockRepo.findByRepoId.mockResolvedValue(policies);

      const result = await service.getForRepo({ orgId: 10, repoId: 100 });

      expect(result.isRestricted).toBe(true);
      expect(result.policies).toHaveLength(1);
    });
  });

  describe('setForRepo', () => {
    it('should validate provider exists', async () => {
      mockRegistry.getById.mockReturnValue(undefined);

      await expect(
        service.setForRepo({
          orgId: 10,
          repoId: 100,
          dto: { policies: [{ provider: 'unknown', model: 'some-model' }] },
          userId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate model against provider pattern', async () => {
      mockRegistry.getById.mockReturnValue({ id: 'claude-code' });
      mockRegistry.validateModel.mockReturnValue(false);

      await expect(
        service.setForRepo({
          orgId: 10,
          repoId: 100,
          dto: { policies: [{ provider: 'claude-code', model: 'invalid!!!' }] },
          userId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set policies when all entries are valid', async () => {
      mockRegistry.getById.mockReturnValue({ id: 'claude-code' });
      mockRegistry.validateModel.mockReturnValue(true);
      const policies = [makePolicy()];
      mockRepo.setForRepo.mockResolvedValue(policies);

      const result = await service.setForRepo({
        orgId: 10,
        repoId: 100,
        dto: { policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }] },
        userId: 1,
      });

      expect(result.isRestricted).toBe(true);
      expect(result.policies).toHaveLength(1);
      expect(mockRepo.setForRepo).toHaveBeenCalledWith({
        orgId: 10,
        repoId: 100,
        policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        createdBy: 1,
      });
    });

    it('should clear policies when empty array is provided', async () => {
      mockRepo.setForRepo.mockResolvedValue([]);

      const result = await service.setForRepo({
        orgId: 10,
        repoId: 100,
        dto: { policies: [] },
        userId: 1,
      });

      expect(result.isRestricted).toBe(false);
      expect(result.policies).toEqual([]);
    });
  });

  describe('validateModelAllowed', () => {
    it('should not throw when repo is unrestricted', async () => {
      mockRepo.isModelAllowed.mockResolvedValue(true);

      await expect(
        service.validateModelAllowed({
          orgId: 10,
          repoId: 100,
          provider: 'claude-code',
          model: 'claude-sonnet-4-5-20250929',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw when model is not allowed', async () => {
      mockRepo.isModelAllowed.mockResolvedValue(false);

      await expect(
        service.validateModelAllowed({
          orgId: 10,
          repoId: 100,
          provider: 'codex',
          model: 'codex-mini',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include provider and model in error message', async () => {
      mockRepo.isModelAllowed.mockResolvedValue(false);

      await expect(
        service.validateModelAllowed({
          orgId: 10,
          repoId: 100,
          provider: 'codex',
          model: 'codex-mini',
        }),
      ).rejects.toThrow(/codex-mini.*codex/);
    });
  });
});
