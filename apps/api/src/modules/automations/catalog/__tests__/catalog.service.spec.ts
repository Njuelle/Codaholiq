import * as fs from 'node:fs';
import { CatalogService } from '../catalog.service';

vi.mock('node:fs');
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    join: vi.fn((...args: string[]) => actual.join(...args)),
    basename: (...args: Parameters<typeof actual.basename>) => actual.basename(...args),
    extname: (...args: Parameters<typeof actual.extname>) => actual.extname(...args),
  };
});

const validEventTemplate = `
name: "PR Code Review"
description: "Reviews pull requests for quality."
category: "Code Quality"
icon: "search-code"
triggerType: "event"
triggerConfig:
  events:
    - "pull_request.opened"
promptTemplate: "Review the PR in {{repo.full_name}}."
model: null
variables: []
`;

const validCronTemplate = `
name: "Nightly Audit"
description: "Runs a nightly code audit."
category: "Code Quality"
icon: "clock"
triggerType: "cron"
triggerConfig:
  schedule: "0 2 * * *"
promptTemplate: "Audit the codebase of {{repo.full_name}}."
model: null
variables: []
`;

const validManualTemplate = `
name: "Code Refactor"
description: "On-demand refactoring."
category: "Maintenance"
icon: "wrench"
triggerType: "manual"
triggerConfig: {}
promptTemplate: "Refactor {{repo.full_name}}."
model: null
variables: []
`;

const invalidTemplate = `
name: ""
description: ""
category: ""
`;

describe('CatalogService', () => {
  let service: CatalogService;
  const mockExistsSync = vi.mocked(fs.existsSync);
  const mockReaddirSync = vi.mocked(fs.readdirSync);
  const mockReadFileSync = vi.mocked(fs.readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService();
  });

  describe('onModuleInit', () => {
    it('should load valid YAML templates from the templates directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'pr-code-review.yaml' as never,
        'nightly-audit.yaml' as never,
      ]);
      mockReadFileSync
        .mockReturnValueOnce(validEventTemplate)
        .mockReturnValueOnce(validCronTemplate);

      service.onModuleInit();

      const categories = service.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Code Quality');
      expect(categories[0].templates).toHaveLength(2);
    });

    it('should skip invalid YAML templates without crashing', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'valid.yaml' as never,
        'invalid.yaml' as never,
      ]);
      mockReadFileSync
        .mockReturnValueOnce(validEventTemplate)
        .mockReturnValueOnce(invalidTemplate);

      service.onModuleInit();

      const categories = service.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].templates).toHaveLength(1);
    });

    it('should handle missing templates directory gracefully', () => {
      mockExistsSync.mockReturnValue(false);

      service.onModuleInit();

      expect(service.getCategories()).toHaveLength(0);
    });

    it('should skip non-YAML files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'template.yaml' as never,
        'readme.md' as never,
        'notes.txt' as never,
      ]);
      mockReadFileSync.mockReturnValueOnce(validEventTemplate);

      service.onModuleInit();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'error.yaml' as never,
      ]);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      service.onModuleInit();

      expect(service.getCategories()).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should group templates by category and sort alphabetically', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'manual-refactor.yaml' as never,
        'pr-code-review.yaml' as never,
      ]);
      mockReadFileSync
        .mockReturnValueOnce(validManualTemplate)
        .mockReturnValueOnce(validEventTemplate);

      service.onModuleInit();

      const categories = service.getCategories();
      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('Code Quality');
      expect(categories[1].name).toBe('Maintenance');
    });
  });

  describe('getTemplateBySlug', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'pr-code-review.yaml' as never,
      ]);
      mockReadFileSync.mockReturnValueOnce(validEventTemplate);
      service.onModuleInit();
    });

    it('should return the template for a valid slug', () => {
      const template = service.getTemplateBySlug({ slug: 'pr-code-review' });

      expect(template).toBeDefined();
      expect(template?.slug).toBe('pr-code-review');
      expect(template?.name).toBe('PR Code Review');
      expect(template?.triggerType).toBe('event');
    });

    it('should return undefined for an unknown slug', () => {
      const template = service.getTemplateBySlug({ slug: 'nonexistent' });

      expect(template).toBeUndefined();
    });

    it('should derive slug from filename without extension', () => {
      const template = service.getTemplateBySlug({ slug: 'pr-code-review' });

      expect(template?.slug).toBe('pr-code-review');
    });
  });

  describe('template validation', () => {
    it('should load templates with variables', () => {
      const templateWithVars = `
name: "PR Review with Depth"
description: "Reviews PRs with configurable depth."
category: "Code Quality"
icon: "search-code"
triggerType: "event"
triggerConfig:
  events:
    - "pull_request.opened"
promptTemplate: "Review the PR."
model: null
variables:
  - key: "review_depth"
    value: "thorough"
    source: "static"
    required: false
`;

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'review.yaml' as never,
      ]);
      mockReadFileSync.mockReturnValueOnce(templateWithVars);

      service.onModuleInit();

      const template = service.getTemplateBySlug({ slug: 'review' });
      expect(template?.variables).toHaveLength(1);
      expect(template?.variables[0].key).toBe('review_depth');
    });

    it('should accept .yml extension', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'template.yml' as never,
      ]);
      mockReadFileSync.mockReturnValueOnce(validEventTemplate);

      service.onModuleInit();

      const template = service.getTemplateBySlug({ slug: 'template' });
      expect(template).toBeDefined();
    });
  });
});
