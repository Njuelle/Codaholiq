import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationService } from '../automations.service';
import { AutomationRepository } from '../automations.repository';
import { ExecutionLifecycleService } from '../../executions/execution-lifecycle.service';
import { GitHubEntityRepository } from '../../github/github-entity.repository';
import { TriggerValidationService } from '../triggers/trigger-validation.service';
import { PromptTemplateService } from '../templates/prompt-template.service';
import { CronSchedulerService } from '../triggers/cron-scheduler.service';
import { SanitizationService } from '../../../common/sanitization/sanitization.service';
import { VariablesService } from '../../variables/variables.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProvidersRegistry } from '../../providers/providers.registry';

function createMockProvidersRegistry() {
  return {
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(undefined),
    getByIdOrThrow: vi.fn().mockReturnValue({
      id: 'claude-code',
      name: 'Claude Code',
      models: [],
      defaultModelId: 'claude-sonnet-4-5-20250929',
      secrets: [],
      modelIdPattern: /^claude-[a-z0-9.-]+$/,
    }),
    getDefault: vi.fn(),
    getProviderIds: vi.fn().mockReturnValue(['claude-code']),
    validateModel: vi.fn().mockReturnValue(true),
    getModelsForProvider: vi.fn().mockReturnValue([]),
    mapDispatchInputs: vi.fn().mockReturnValue({ provider: 'claude-code', prompt: 'test' }),
  };
}

function createMockVariablesService() {
  return {
    findForResolution: vi.fn().mockResolvedValue([]),
  };
}

function createMockCatalogService() {
  return {
    getCategories: vi.fn().mockReturnValue([]),
    getTemplateBySlug: vi.fn(),
  };
}

function createMockSanitizationService() {
  return {
    stripHtml: vi.fn().mockImplementation(({ input }: { input: string }) => input),
    hasTemplateInjection: vi.fn().mockReturnValue(false),
    sanitizeForStorage: vi.fn().mockImplementation(({ input }: { input: string }) => input),
  };
}

function createMockAutomationRepository() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrgId: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    countByOrgId: vi.fn().mockResolvedValue(0),
  };
}

function createMockExecutionLifecycle() {
  return {
    createAndQueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
  };
}

function createMockGitHubEntityRepository() {
  return {
    findRepositoryById: vi.fn(),
  };
}

function createMockTriggerValidation() {
  return {
    validateEventConfig: vi.fn(),
    validateCronConfig: vi.fn(),
    validateManualConfig: vi.fn(),
  };
}

function createMockPromptTemplate() {
  return {
    validateTemplate: vi.fn(),
    validateVariableValues: vi.fn(),
    resolve: vi.fn().mockReturnValue('resolved prompt'),
    extractVariables: vi.fn().mockReturnValue([]),
  };
}

function createMockCronScheduler() {
  return {
    registerCron: vi.fn().mockResolvedValue(undefined),
    unregisterCron: vi.fn().mockResolvedValue(undefined),
    updateCron: vi.fn().mockResolvedValue(undefined),
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

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: 100,
    name: 'test-automation',
    description: null,
    triggerType: 'event' as const,
    triggerConfig: { events: ['pull_request.opened'] },
    promptTemplate: 'Review {{pr.title}}',
    provider: 'claude-code',
    model: null,
    workflowFile: '.github/workflows/codaholiq.yml',
    enabled: true,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    variables: [],
    ...overrides,
  };
}

describe('AutomationService', () => {
  let service: AutomationService;
  let automationRepo: ReturnType<typeof createMockAutomationRepository>;
  let executionLifecycle: ReturnType<typeof createMockExecutionLifecycle>;
  let githubRepo: ReturnType<typeof createMockGitHubEntityRepository>;
  let triggerValidation: ReturnType<typeof createMockTriggerValidation>;
  let promptTemplate: ReturnType<typeof createMockPromptTemplate>;
  let cronScheduler: ReturnType<typeof createMockCronScheduler>;
  let catalogService: ReturnType<typeof createMockCatalogService>;
  let sanitizationService: ReturnType<typeof createMockSanitizationService>;
  let variablesService: ReturnType<typeof createMockVariablesService>;

  beforeEach(() => {
    automationRepo = createMockAutomationRepository();
    executionLifecycle = createMockExecutionLifecycle();
    githubRepo = createMockGitHubEntityRepository();
    triggerValidation = createMockTriggerValidation();
    promptTemplate = createMockPromptTemplate();
    cronScheduler = createMockCronScheduler();
    catalogService = createMockCatalogService();
    sanitizationService = createMockSanitizationService();
    variablesService = createMockVariablesService();

    service = new AutomationService(
      automationRepo as unknown as AutomationRepository,
      executionLifecycle as unknown as ExecutionLifecycleService,
      githubRepo as unknown as GitHubEntityRepository,
      triggerValidation as unknown as TriggerValidationService,
      promptTemplate as unknown as PromptTemplateService,
      cronScheduler as unknown as CronSchedulerService,
      sanitizationService as unknown as SanitizationService,
      variablesService as unknown as VariablesService,
      catalogService as unknown as CatalogService,
      createMockProvidersRegistry() as unknown as ProvidersRegistry,
      { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );
  });

  describe('create', () => {
    const eventDto = {
      name: 'test-automation',
      repoId: 100,
      triggerType: 'event' as const,
      triggerConfig: { events: ['pull_request.opened'] },
      promptTemplate: 'Review {{pr.title}}',
      provider: 'claude-code',
      model: null,
      enabled: true,
      variables: [],
    };

    it('should create an event-triggered automation', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const created = makeAutomation();
      automationRepo.create.mockResolvedValue(created);

      const result = await service.create({
        orgId: 10,
        userId: 1,
        dto: eventDto,
      });

      expect(result).toEqual(created);
      expect(automationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 10,
          createdBy: 1,
          triggerType: 'event',
        }),
      );
    });

    it('should create a cron-triggered automation and register cron', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const cronAutomation = makeAutomation({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
      });
      automationRepo.create.mockResolvedValue(cronAutomation);

      await service.create({
        orgId: 10,
        userId: 1,
        dto: {
          ...eventDto,
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
        },
      });

      expect(cronScheduler.registerCron).toHaveBeenCalledWith({
        automationId: 1,
        schedule: '0 * * * *',
        timezone: undefined,
      });
    });

    it('should not register cron when automation is disabled', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const cronAutomation = makeAutomation({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
        enabled: false,
      });
      automationRepo.create.mockResolvedValue(cronAutomation);

      await service.create({
        orgId: 10,
        userId: 1,
        dto: {
          ...eventDto,
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
          enabled: false,
        },
      });

      expect(cronScheduler.registerCron).not.toHaveBeenCalled();
    });

    it('should create a manual-triggered automation', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const manualAutomation = makeAutomation({
        triggerType: 'manual',
        triggerConfig: {},
      });
      automationRepo.create.mockResolvedValue(manualAutomation);

      const result = await service.create({
        orgId: 10,
        userId: 1,
        dto: {
          ...eventDto,
          triggerType: 'manual',
          triggerConfig: {},
        },
      });

      expect(result.triggerType).toBe('manual');
      expect(cronScheduler.registerCron).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when repo not found', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(service.create({ orgId: 10, userId: 1, dto: eventDto })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when repo does not belong to org', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo({ orgId: 99 }));

      await expect(service.create({ orgId: 10, userId: 1, dto: eventDto })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should validate event trigger config', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      triggerValidation.validateEventConfig.mockImplementation(() => {
        throw new BadRequestException('Unknown event');
      });

      await expect(service.create({ orgId: 10, userId: 1, dto: eventDto })).rejects.toThrow(
        'Unknown event',
      );
    });

    it('should validate prompt template syntax', async () => {
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      promptTemplate.validateTemplate.mockImplementation(() => {
        throw new BadRequestException('Unbalanced braces');
      });

      await expect(service.create({ orgId: 10, userId: 1, dto: eventDto })).rejects.toThrow(
        'Unbalanced braces',
      );
    });
  });

  describe('findById', () => {
    it('should return automation when found and belongs to org', async () => {
      const automation = makeAutomation();
      automationRepo.findById.mockResolvedValue(automation);

      const result = await service.findById({ orgId: 10, automationId: 1 });

      expect(result).toEqual(automation);
    });

    it('should throw NotFoundException when not found', async () => {
      automationRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById({ orgId: 10, automationId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when wrong org', async () => {
      automationRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById({ orgId: 10, automationId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('should delegate to repository', async () => {
      const automations = [makeAutomation()];
      automationRepo.findByOrgId.mockResolvedValue(automations);

      const result = await service.list({ orgId: 10 });

      expect(result).toEqual(automations);
      expect(automationRepo.findByOrgId).toHaveBeenCalledWith({
        orgId: 10,
        filters: undefined,
      });
    });

    it('should pass filters to repository', async () => {
      automationRepo.findByOrgId.mockResolvedValue([]);
      const filters = {
        triggerType: 'cron' as const,
        enabled: true,
        limit: 10,
      };

      await service.list({ orgId: 10, filters });

      expect(automationRepo.findByOrgId).toHaveBeenCalledWith({
        orgId: 10,
        filters,
      });
    });
  });

  describe('update', () => {
    it('should update automation fields', async () => {
      const existing = makeAutomation();
      automationRepo.findById.mockResolvedValue(existing);
      const updated = { ...existing, name: 'updated-name' };
      automationRepo.update.mockResolvedValue(updated);

      const result = await service.update({
        orgId: 10,
        automationId: 1,
        dto: { name: 'updated-name' },
      });

      expect(result.name).toBe('updated-name');
    });

    it('should re-validate trigger config when changed', async () => {
      const existing = makeAutomation();
      automationRepo.findById.mockResolvedValue(existing);
      automationRepo.update.mockResolvedValue(existing);

      await service.update({
        orgId: 10,
        automationId: 1,
        dto: {
          triggerType: 'event',
          triggerConfig: { events: ['push'] },
        },
      });

      expect(triggerValidation.validateEventConfig).toHaveBeenCalledWith({
        config: { events: ['push'] },
      });
    });

    it('should update cron scheduler when trigger config changes to cron', async () => {
      const existing = makeAutomation({ triggerType: 'manual', triggerConfig: {} });
      automationRepo.findById.mockResolvedValue(existing);
      const updated = makeAutomation({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
      });
      automationRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        automationId: 1,
        dto: {
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
        },
      });

      expect(cronScheduler.registerCron).toHaveBeenCalled();
    });

    it('should unregister cron when switching from cron to event', async () => {
      const existing = makeAutomation({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
      });
      automationRepo.findById.mockResolvedValue(existing);
      const updated = makeAutomation({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });
      automationRepo.update.mockResolvedValue(updated);

      await service.update({
        orgId: 10,
        automationId: 1,
        dto: {
          triggerType: 'event',
          triggerConfig: { events: ['push'] },
        },
      });

      expect(cronScheduler.unregisterCron).toHaveBeenCalledWith({
        automationId: 1,
      });
    });

    it('should validate trigger config even when only triggerConfig changes (defense-in-depth)', async () => {
      const existing = makeAutomation({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 * * * *' },
      });
      automationRepo.findById.mockResolvedValue(existing);
      automationRepo.update.mockResolvedValue(existing);

      triggerValidation.validateCronConfig.mockImplementation(() => {
        throw new BadRequestException('Cron schedule interval must be at least 5 minutes');
      });

      await expect(
        service.update({
          orgId: 10,
          automationId: 1,
          dto: {
            triggerType: 'cron',
            triggerConfig: { schedule: '* * * * *' },
          },
        }),
      ).rejects.toThrow('Cron schedule interval must be at least 5 minutes');
    });

    it('should enforce org scoping', async () => {
      automationRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.update({
          orgId: 10,
          automationId: 1,
          dto: { name: 'hack' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete automation', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation());

      await service.delete({ orgId: 10, automationId: 1 });

      expect(automationRepo.delete).toHaveBeenCalledWith({ id: 1, orgId: 10 });
    });

    it('should unregister cron when deleting cron automation', async () => {
      automationRepo.findById.mockResolvedValue(
        makeAutomation({
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
        }),
      );

      await service.delete({ orgId: 10, automationId: 1 });

      expect(cronScheduler.unregisterCron).toHaveBeenCalledWith({
        automationId: 1,
      });
    });

    it('should not touch scheduler for non-cron automation', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation());

      await service.delete({ orgId: 10, automationId: 1 });

      expect(cronScheduler.unregisterCron).not.toHaveBeenCalled();
    });

    it('should enforce org scoping', async () => {
      automationRepo.findById.mockResolvedValue(undefined);

      await expect(service.delete({ orgId: 10, automationId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setEnabled', () => {
    it('should enable automation and register cron', async () => {
      automationRepo.findById.mockResolvedValue(
        makeAutomation({
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
          enabled: false,
        }),
      );

      await service.setEnabled({
        orgId: 10,
        automationId: 1,
        enabled: true,
      });

      expect(automationRepo.setEnabled).toHaveBeenCalledWith({
        id: 1,
        orgId: 10,
        enabled: true,
      });
      expect(cronScheduler.registerCron).toHaveBeenCalledWith({
        automationId: 1,
        schedule: '0 * * * *',
        timezone: undefined,
      });
    });

    it('should disable automation and unregister cron', async () => {
      automationRepo.findById.mockResolvedValue(
        makeAutomation({
          triggerType: 'cron',
          triggerConfig: { schedule: '0 * * * *' },
        }),
      );

      await service.setEnabled({
        orgId: 10,
        automationId: 1,
        enabled: false,
      });

      expect(cronScheduler.unregisterCron).toHaveBeenCalledWith({
        automationId: 1,
      });
    });

    it('should not touch scheduler for non-cron automations', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation());

      await service.setEnabled({
        orgId: 10,
        automationId: 1,
        enabled: false,
      });

      expect(cronScheduler.registerCron).not.toHaveBeenCalled();
      expect(cronScheduler.unregisterCron).not.toHaveBeenCalled();
    });
  });

  describe('triggerManual', () => {
    it('should create execution for enabled automation', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation());
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());

      const result = await service.triggerManual({
        orgId: 10,
        automationId: 1,
        userId: 1,
      });

      expect(result).toEqual({ id: 1, status: 'pending' });
      expect(executionLifecycle.createAndQueue).toHaveBeenCalledWith({
        automationId: 1,
        automationName: 'test-automation',
        repoId: 100,
        workflowFile: '.github/workflows/codaholiq.yml',
        triggerEvent: { type: 'manual', triggered_by: 1 },
        resolvedPrompt: 'resolved prompt',
        provider: 'claude-code',
        model: null,
      });
    });

    it('should reject disabled automation', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation({ enabled: false }));

      await expect(
        service.triggerManual({
          orgId: 10,
          automationId: 1,
          userId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should apply variable overrides', async () => {
      const automation = makeAutomation({
        variables: [
          {
            id: 1,
            automationId: 1,
            key: 'branch',
            value: 'main',
            source: 'static',
            required: false,
            createdAt: new Date(),
          },
        ],
      });
      automationRepo.findById.mockResolvedValue(automation);
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());

      await service.triggerManual({
        orgId: 10,
        automationId: 1,
        userId: 1,
        variableOverrides: { branch: 'feature-x' },
      });

      expect(promptTemplate.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.arrayContaining([
            expect.objectContaining({ key: 'branch', value: 'feature-x' }),
          ]),
        }),
      );
    });

    it('should pass built-in variables to prompt resolution', async () => {
      automationRepo.findById.mockResolvedValue(makeAutomation());
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());

      await service.triggerManual({
        orgId: 10,
        automationId: 1,
        userId: 1,
      });

      expect(promptTemplate.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          builtIns: expect.objectContaining({
            'repo.owner': 'octocat',
            'repo.name': 'hello-world',
            'repo.full_name': 'octocat/hello-world',
            'automation.name': 'test-automation',
          }),
        }),
      );
    });
  });

  describe('createFromTemplate', () => {
    const mockTemplate = {
      slug: 'pr-code-review',
      name: 'PR Code Review',
      description: 'Reviews pull requests.',
      category: 'Code Quality',
      icon: 'search-code',
      triggerType: 'event' as const,
      triggerConfig: { events: ['pull_request.opened'] },
      promptTemplate: 'Review the PR in {{repo.full_name}}.',
      provider: 'claude-code',
      model: null,
      variables: [],
    };

    it('should create an automation from a catalog template', async () => {
      catalogService.getTemplateBySlug.mockReturnValue(mockTemplate);
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      const created = makeAutomation({ name: 'PR Code Review (hello-world)' });
      automationRepo.create.mockResolvedValue(created);

      const result = await service.createFromTemplate({
        orgId: 10,
        userId: 1,
        templateSlug: 'pr-code-review',
        repoId: 100,
      });

      expect(result).toEqual(created);
      expect(catalogService.getTemplateBySlug).toHaveBeenCalledWith({
        slug: 'pr-code-review',
      });
      expect(automationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PR Code Review (hello-world)',
          triggerType: 'event',
          promptTemplate: 'Review the PR in {{repo.full_name}}.',
        }),
      );
    });

    it('should throw NotFoundException for unknown template slug', async () => {
      catalogService.getTemplateBySlug.mockReturnValue(undefined);

      await expect(
        service.createFromTemplate({
          orgId: 10,
          userId: 1,
          templateSlug: 'nonexistent',
          repoId: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include repo name in automation name', async () => {
      catalogService.getTemplateBySlug.mockReturnValue(mockTemplate);
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo({ name: 'my-app' }));
      automationRepo.create.mockResolvedValue(makeAutomation({ name: 'PR Code Review (my-app)' }));

      await service.createFromTemplate({
        orgId: 10,
        userId: 1,
        templateSlug: 'pr-code-review',
        repoId: 100,
      });

      expect(automationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PR Code Review (my-app)',
        }),
      );
    });

    it('should throw NotFoundException when repository not found', async () => {
      catalogService.getTemplateBySlug.mockReturnValue(mockTemplate);
      githubRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(
        service.createFromTemplate({
          orgId: 10,
          userId: 1,
          templateSlug: 'pr-code-review',
          repoId: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass template variables to create', async () => {
      const templateWithVars = {
        ...mockTemplate,
        variables: [
          { key: 'depth', value: 'thorough', source: 'static' as const, required: false },
        ],
      };
      catalogService.getTemplateBySlug.mockReturnValue(templateWithVars);
      githubRepo.findRepositoryById.mockResolvedValue(makeRepo());
      automationRepo.create.mockResolvedValue(makeAutomation());

      await service.createFromTemplate({
        orgId: 10,
        userId: 1,
        templateSlug: 'pr-code-review',
        repoId: 100,
      });

      expect(automationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: [{ key: 'depth', value: 'thorough', source: 'static', required: false }],
        }),
      );
    });
  });
});
