import { NotFoundException } from '@nestjs/common';
import { ProvidersController } from '../providers.controller';
import { ProvidersRegistry } from '../providers.registry';

describe('ProvidersController', () => {
  let controller: ProvidersController;
  let registry: ProvidersRegistry;

  beforeEach(() => {
    registry = new ProvidersRegistry();
    controller = new ProvidersController(registry);
  });

  describe('listProviders', () => {
    it('should return all providers with default provider ID', () => {
      const result = controller.listProviders();

      expect(result.defaultProviderId).toBe('claude-code');
      expect(result.providers.length).toBeGreaterThanOrEqual(4);
      expect(result.providers.map((p) => p.id)).toContain('claude-code');
    });
  });

  describe('getProvider', () => {
    it('should return a specific provider by ID', () => {
      const result = controller.getProvider('claude-code');

      expect(result.id).toBe('claude-code');
      expect(result.name).toBe('Claude Code');
    });

    it('should throw NotFoundException for unknown provider', () => {
      expect(() => controller.getProvider('nonexistent')).toThrow(NotFoundException);
    });
  });
});
