import { BadRequestException } from '@nestjs/common';
import { ProvidersRegistry, DEFAULT_PROVIDER_ID } from '../providers.registry';

describe('ProvidersRegistry', () => {
  let registry: ProvidersRegistry;

  beforeEach(() => {
    registry = new ProvidersRegistry();
  });

  describe('getAll', () => {
    it('should return all registered providers', () => {
      const providers = registry.getAll();

      expect(providers.length).toBeGreaterThanOrEqual(4);
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('claude-code');
      expect(ids).toContain('opencode');
      expect(ids).toContain('codex');
      expect(ids).toContain('gemini');
    });

    it('should return readonly array', () => {
      const providers = registry.getAll();
      expect(Array.isArray(providers)).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return provider by ID', () => {
      const provider = registry.getById('claude-code');

      expect(provider).toBeDefined();
      expect(provider?.id).toBe('claude-code');
      expect(provider?.name).toBe('Claude Code');
    });

    it('should return undefined for unknown provider', () => {
      expect(registry.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('getByIdOrThrow', () => {
    it('should return provider by ID', () => {
      const provider = registry.getByIdOrThrow('claude-code');

      expect(provider.id).toBe('claude-code');
    });

    it('should throw BadRequestException for unknown provider', () => {
      expect(() => registry.getByIdOrThrow('nonexistent')).toThrow(BadRequestException);
      expect(() => registry.getByIdOrThrow('nonexistent')).toThrow('Unknown provider: nonexistent');
    });
  });

  describe('getDefault', () => {
    it('should return claude-code as default', () => {
      const defaultProvider = registry.getDefault();

      expect(defaultProvider.id).toBe('claude-code');
    });
  });

  describe('DEFAULT_PROVIDER_ID', () => {
    it('should be claude-code', () => {
      expect(DEFAULT_PROVIDER_ID).toBe('claude-code');
    });
  });

  describe('getProviderIds', () => {
    it('should return all provider IDs', () => {
      const ids = registry.getProviderIds();

      expect(ids).toContain('claude-code');
      expect(ids).toContain('opencode');
      expect(ids).toContain('codex');
      expect(ids).toContain('gemini');
    });
  });

  describe('validateModel', () => {
    it('should validate claude-code model IDs', () => {
      expect(
        registry.validateModel({
          providerId: 'claude-code',
          modelId: 'claude-sonnet-4-5-20250929',
        }),
      ).toBe(true);
      expect(
        registry.validateModel({ providerId: 'claude-code', modelId: 'claude-opus-4-6' }),
      ).toBe(true);
      expect(registry.validateModel({ providerId: 'claude-code', modelId: 'invalid!' })).toBe(
        false,
      );
    });

    it('should validate opencode model IDs', () => {
      expect(
        registry.validateModel({
          providerId: 'opencode',
          modelId: 'anthropic/claude-sonnet-4-20250514',
        }),
      ).toBe(true);
      expect(registry.validateModel({ providerId: 'opencode', modelId: 'openai/gpt-4.1' })).toBe(
        true,
      );
      expect(registry.validateModel({ providerId: 'opencode', modelId: 'noslash' })).toBe(false);
    });

    it('should validate codex model IDs', () => {
      expect(registry.validateModel({ providerId: 'codex', modelId: 'codex-mini' })).toBe(true);
      expect(registry.validateModel({ providerId: 'codex', modelId: 'o4-mini' })).toBe(true);
      expect(registry.validateModel({ providerId: 'codex', modelId: 'invalid/slash' })).toBe(false);
    });

    it('should validate gemini model IDs', () => {
      expect(registry.validateModel({ providerId: 'gemini', modelId: 'gemini-2.5-pro' })).toBe(
        true,
      );
      expect(registry.validateModel({ providerId: 'gemini', modelId: 'gemini-2.5-flash' })).toBe(
        true,
      );
      expect(registry.validateModel({ providerId: 'gemini', modelId: 'gpt-4' })).toBe(false);
    });

    it('should return false for unknown provider', () => {
      expect(registry.validateModel({ providerId: 'unknown', modelId: 'any' })).toBe(false);
    });
  });

  describe('getModelsForProvider', () => {
    it('should return models for known provider', () => {
      const models = registry.getModelsForProvider('claude-code');

      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('description');
    });

    it('should return empty array for unknown provider', () => {
      expect(registry.getModelsForProvider('unknown')).toEqual([]);
    });
  });

  describe('mapDispatchInputs', () => {
    it('should build dispatch inputs with provider and prompt', () => {
      const inputs = registry.mapDispatchInputs({
        providerId: 'claude-code',
        prompt: 'Review this PR',
      });

      expect(inputs).toEqual({
        provider: 'claude-code',
        prompt: 'Review this PR',
      });
    });

    it('should include model when provided', () => {
      const inputs = registry.mapDispatchInputs({
        providerId: 'claude-code',
        prompt: 'Review this PR',
        model: 'claude-opus-4-6',
      });

      expect(inputs).toEqual({
        provider: 'claude-code',
        prompt: 'Review this PR',
        model: 'claude-opus-4-6',
      });
    });

    it('should omit model when null', () => {
      const inputs = registry.mapDispatchInputs({
        providerId: 'claude-code',
        prompt: 'test',
        model: null,
      });

      expect(inputs).toEqual({
        provider: 'claude-code',
        prompt: 'test',
      });
    });

    it('should throw for unknown provider', () => {
      expect(() =>
        registry.mapDispatchInputs({
          providerId: 'nonexistent',
          prompt: 'test',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('provider definitions', () => {
    it('each provider should have a default model that exists in its model list', () => {
      for (const provider of registry.getAll()) {
        const modelIds = provider.models.map((m) => m.id);
        expect(modelIds).toContain(provider.defaultModelId);
      }
    });

    it('each provider should have at least one model', () => {
      for (const provider of registry.getAll()) {
        expect(provider.models.length).toBeGreaterThan(0);
      }
    });

    it('each provider should have at least one secret requirement', () => {
      for (const provider of registry.getAll()) {
        expect(provider.secrets.length).toBeGreaterThan(0);
      }
    });

    it('each provider default model should match its own modelIdPattern', () => {
      for (const provider of registry.getAll()) {
        expect(provider.modelIdPattern.test(provider.defaultModelId)).toBe(true);
      }
    });
  });
});
