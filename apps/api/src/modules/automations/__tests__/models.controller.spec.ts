import { ModelsController } from '../models.controller';
import { SUPPORTED_MODELS, DEFAULT_MODEL, type ClaudeModel } from '../models.constants';

describe('ModelsController', () => {
  let controller: ModelsController;

  beforeEach(() => {
    controller = new ModelsController();
  });

  describe('getSupportedModels', () => {
    it('should return the supported models array', () => {
      const result = controller.getSupportedModels();

      expect(result.models).toBe(SUPPORTED_MODELS);
      expect(result.models).toHaveLength(SUPPORTED_MODELS.length);
    });

    it('should return the correct defaultModelId', () => {
      const result = controller.getSupportedModels();

      expect(result.defaultModelId).toBe(DEFAULT_MODEL.id);
    });

    it('should include id, name, and description on every model', () => {
      const result = controller.getSupportedModels();

      for (const model of result.models) {
        const typed: ClaudeModel = model;
        expect(typeof typed.id).toBe('string');
        expect(typed.id.length).toBeGreaterThan(0);
        expect(typeof typed.name).toBe('string');
        expect(typed.name.length).toBeGreaterThan(0);
        expect(typeof typed.description).toBe('string');
        expect(typed.description.length).toBeGreaterThan(0);
      }
    });
  });
});
