import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationRepository } from './automations.repository';
import { ExecutionLifecycleService } from '../executions/execution-lifecycle.service';
import { GitHubEntityRepository } from '../github/github-entity.repository';
import { TriggerValidationService } from './triggers/trigger-validation.service';
import { PromptTemplateService } from './templates/prompt-template.service';
import { CronSchedulerService } from './triggers/cron-scheduler.service';
import { SanitizationService } from '../../common/sanitization/sanitization.service';
import { VariablesService } from '../variables/variables.service';
import { CatalogService } from './catalog/catalog.service';
import { ProvidersRegistry, DEFAULT_PROVIDER_ID } from '../providers/providers.registry';
import { AutomationCreateDto } from './dto/create-automation.dto';
import { AutomationUpdateDto } from './dto/update-automation.dto';
import type { ValidatePromptDto } from './dto/validate-prompt.dto';
import type { AutomationWithVariables } from './automations.types';
import { asCronConfig, asEventConfig } from './trigger-config.types';
import { automations, DEFAULT_WORKFLOW_FILE } from './automations.schema';
import { executions } from '../executions/executions.schema';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  private readonly maxAutomationsPerOrg: number;

  constructor(
    @Inject(AutomationRepository)
    private readonly automationRepository: AutomationRepository,
    @Inject(ExecutionLifecycleService)
    private readonly executionLifecycle: ExecutionLifecycleService,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
    @Inject(TriggerValidationService)
    private readonly triggerValidation: TriggerValidationService,
    @Inject(PromptTemplateService)
    private readonly promptTemplate: PromptTemplateService,
    @Inject(CronSchedulerService)
    private readonly cronScheduler: CronSchedulerService,
    @Inject(SanitizationService)
    private readonly sanitization: SanitizationService,
    @Inject(VariablesService)
    private readonly variablesService: VariablesService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(ProvidersRegistry)
    private readonly providersRegistry: ProvidersRegistry,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.maxAutomationsPerOrg = parseInt(
      this.configService.get<string>('MAX_AUTOMATIONS_PER_ORG') ?? '100',
      10,
    );
  }

  async create({
    orgId,
    userId,
    dto,
  }: {
    orgId: number;
    userId: number;
    dto: AutomationCreateDto;
  }): Promise<AutomationWithVariables> {
    await this.validateOrgAndRepo({ orgId, repoId: dto.repoId });
    return this.saveAutomation({ orgId, userId, dto });
  }

  async createFromTemplate({
    orgId,
    userId,
    templateSlug,
    repoId,
  }: {
    orgId: number;
    userId: number;
    templateSlug: string;
    repoId: number;
  }): Promise<AutomationWithVariables> {
    const template = this.catalogService.getTemplateBySlug({ slug: templateSlug });
    if (!template) {
      throw new NotFoundException(`Catalog template "${templateSlug}" not found`);
    }

    const repo = await this.validateOrgAndRepo({ orgId, repoId });
    const name = `${template.name} (${repo.name})`;

    return this.saveAutomation({
      orgId,
      userId,
      dto: {
        name,
        description: template.description,
        repoId,
        triggerType: template.triggerType,
        triggerConfig: template.triggerConfig,
        promptTemplate: template.promptTemplate,
        provider: template.provider ?? DEFAULT_PROVIDER_ID,
        model: template.model,
        enabled: true,
        variables: template.variables.map((v) => ({
          key: v.key,
          value: v.value,
          source: v.source,
          required: v.required,
        })),
      },
    });
  }

  private async validateOrgAndRepo({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<{ name: string; orgId: number }> {
    const currentCount = await this.automationRepository.countByOrgId({ orgId });
    if (currentCount >= this.maxAutomationsPerOrg) {
      throw new BadRequestException(
        `Organization has reached the maximum of ${this.maxAutomationsPerOrg} automations`,
      );
    }

    const repo = await this.githubEntityRepository.findRepositoryById({ id: repoId });
    if (!repo) {
      throw new NotFoundException('Repository not found');
    }
    if (repo.orgId !== orgId) {
      throw new ForbiddenException('Repository does not belong to this organization');
    }

    return repo;
  }

  private async saveAutomation({
    orgId,
    userId,
    dto,
  }: {
    orgId: number;
    userId: number;
    dto: {
      name: string;
      description?: string | null;
      repoId: number;
      triggerType: 'event' | 'cron' | 'manual';
      triggerConfig: Record<string, unknown>;
      promptTemplate: string;
      provider?: string;
      model?: string | null;
      enabled: boolean;
      variables?: {
        key: string;
        value: string;
        source: 'static' | 'event_payload';
        required: boolean;
      }[];
    };
  }): Promise<AutomationWithVariables> {
    this.validateTriggerConfig({
      triggerType: dto.triggerType,
      triggerConfig: dto.triggerConfig,
    });

    const provider = dto.provider ?? DEFAULT_PROVIDER_ID;
    this.validateProviderAndModel({ provider, model: dto.model });

    this.promptTemplate.validateTemplate({ template: dto.promptTemplate });

    if (dto.variables && dto.variables.length > 0) {
      const staticVars = dto.variables.filter((v) => v.source === 'static');
      if (staticVars.length > 0) {
        this.promptTemplate.validateVariableValues({ variables: staticVars });
      }
    }

    const sanitizedName = this.sanitization.sanitizeForStorage({
      input: dto.name,
      maxLength: 255,
    });
    const sanitizedDescription = dto.description
      ? this.sanitization.sanitizeForStorage({ input: dto.description })
      : dto.description;

    const automation = await this.automationRepository.create({
      orgId,
      repoId: dto.repoId,
      createdBy: userId,
      name: sanitizedName,
      description: sanitizedDescription,
      triggerType: dto.triggerType,
      triggerConfig: dto.triggerConfig,
      promptTemplate: dto.promptTemplate,
      provider,
      model: dto.model ?? null,
      workflowFile: DEFAULT_WORKFLOW_FILE,
      enabled: dto.enabled,
      variables: dto.variables,
    });

    if (dto.triggerType === 'cron' && automation.enabled) {
      const cronConfig = asCronConfig(dto.triggerConfig);
      await this.cronScheduler.registerCron({
        automationId: automation.id,
        schedule: cronConfig.schedule,
        timezone: cronConfig.timezone,
      });
    }

    this.logger.log(`Created automation "${automation.name}" (${automation.id}) for org ${orgId}`);

    return automation;
  }

  async findById({
    orgId,
    automationId,
  }: {
    orgId: number;
    automationId: number;
  }): Promise<AutomationWithVariables> {
    const automation = await this.automationRepository.findById({
      id: automationId,
      orgId,
    });
    if (!automation) {
      throw new NotFoundException('Automation not found');
    }
    return automation;
  }

  async list({
    orgId,
    filters,
  }: {
    orgId: number;
    filters?: {
      triggerType?: 'event' | 'cron' | 'manual';
      enabled?: boolean;
      repoId?: number;
      limit?: number;
      offset?: number;
    };
  }): Promise<(typeof automations.$inferSelect)[]> {
    return this.automationRepository.findByOrgId({ orgId, filters });
  }

  async countByRepoId({ repoId }: { repoId: number }): Promise<number> {
    return this.automationRepository.countByRepoId({ repoId });
  }

  async countByOrgId({ orgId, enabled }: { orgId: number; enabled?: boolean }): Promise<number> {
    return this.automationRepository.countByOrgId({ orgId, enabled });
  }

  async findCronAutomationsByOrgId({
    orgId,
  }: {
    orgId: number;
  }): Promise<(typeof automations.$inferSelect)[]> {
    return this.automationRepository.findCronAutomationsByOrgId({ orgId });
  }

  async update({
    orgId,
    automationId,
    dto,
  }: {
    orgId: number;
    automationId: number;
    dto: AutomationUpdateDto;
  }): Promise<typeof automations.$inferSelect> {
    const existing = await this.findById({ orgId, automationId });

    if (dto.triggerType || dto.triggerConfig) {
      this.validateTriggerConfig({
        triggerType: dto.triggerType ?? existing.triggerType,
        triggerConfig: dto.triggerConfig ?? (existing.triggerConfig as Record<string, unknown>),
      });
    }

    if (dto.promptTemplate) {
      this.promptTemplate.validateTemplate({ template: dto.promptTemplate });
    }

    if (dto.provider !== undefined || dto.model !== undefined) {
      this.validateProviderAndModel({
        provider: dto.provider ?? existing.provider,
        model: dto.model !== undefined ? dto.model : existing.model,
      });
    }

    const updateData = this.buildUpdateData({ dto });

    const updated = await this.automationRepository.update({
      id: automationId,
      orgId,
      data: updateData,
    });

    if (!updated) {
      throw new NotFoundException('Automation not found');
    }

    await this.handleCronChanges({ existing, updated, dto });

    return updated;
  }

  async delete({ orgId, automationId }: { orgId: number; automationId: number }): Promise<void> {
    const automation = await this.findById({ orgId, automationId });

    if (automation.triggerType === 'cron') {
      await this.cronScheduler.unregisterCron({ automationId });
    }

    await this.automationRepository.delete({ id: automationId, orgId });

    this.logger.log(`Deleted automation "${automation.name}" (${automationId})`);
  }

  async setEnabled({
    orgId,
    automationId,
    enabled,
  }: {
    orgId: number;
    automationId: number;
    enabled: boolean;
  }): Promise<void> {
    const automation = await this.findById({ orgId, automationId });

    await this.automationRepository.setEnabled({
      id: automationId,
      orgId,
      enabled,
    });

    if (automation.triggerType === 'cron') {
      if (enabled) {
        const cronConfig = asCronConfig(automation.triggerConfig as Record<string, unknown>);
        await this.cronScheduler.registerCron({
          automationId,
          schedule: cronConfig.schedule,
          timezone: cronConfig.timezone,
        });
      } else {
        await this.cronScheduler.unregisterCron({ automationId });
      }
    }
  }

  async triggerManual({
    orgId,
    automationId,
    userId,
    variableOverrides,
  }: {
    orgId: number;
    automationId: number;
    userId: number;
    variableOverrides?: Record<string, string>;
  }): Promise<typeof executions.$inferSelect> {
    const automation = await this.findById({ orgId, automationId });

    if (!automation.enabled) {
      throw new BadRequestException('Automation is disabled');
    }

    if (variableOverrides) {
      for (const [key, value] of Object.entries(variableOverrides)) {
        if (this.sanitization.hasTemplateInjection({ value })) {
          throw new BadRequestException(`Variable override "${key}" contains template injection`);
        }
      }
    }

    const variables = automation.variables.map((variable) => ({
      key: variable.key,
      value: variableOverrides?.[variable.key] ?? variable.value,
      source: variable.source,
      required: variable.required,
    }));

    const repo = await this.githubEntityRepository.findRepositoryById({
      id: automation.repoId,
    });

    const builtIns: Record<string, string> = {
      'repo.owner': repo?.owner ?? '',
      'repo.name': repo?.name ?? '',
      'repo.full_name': repo?.fullName ?? '',
      timestamp: new Date().toISOString(),
      'automation.name': automation.name,
    };

    const sharedVars = await this.variablesService.findForResolution({
      orgId,
      repoId: automation.repoId,
    });

    const resolvedPrompt = this.promptTemplate.resolve({
      template: automation.promptTemplate,
      variables,
      sharedVariables: sharedVars.map((v) => ({ key: v.key, value: v.value })),
      builtIns,
    });

    return this.executionLifecycle.createAndQueue({
      automationId,
      automationName: automation.name,
      repoId: automation.repoId,
      workflowFile: DEFAULT_WORKFLOW_FILE,
      triggerEvent: { type: 'manual', triggered_by: userId },
      resolvedPrompt,
      provider: automation.provider,
      model: automation.model,
    });
  }

  async validatePrompt({
    orgId,
    automationId,
    dto,
  }: {
    orgId: number;
    automationId: number;
    dto: ValidatePromptDto;
  }): Promise<{ resolvedPrompt: string; variables: string[] }> {
    const automation = await this.findById({ orgId, automationId });

    this.promptTemplate.validateTemplate({ template: dto.promptTemplate });
    const variables = this.promptTemplate.extractVariables({
      template: dto.promptTemplate,
    });

    const variableEntries = automation.variables.map((variable) => ({
      key: variable.key,
      value: dto.sampleVariables[variable.key] ?? variable.value,
      source: variable.source,
      required: variable.required,
    }));

    const sharedVars = await this.variablesService.findForResolution({
      orgId,
      repoId: automation.repoId,
    });

    const resolvedPrompt = this.promptTemplate.resolve({
      template: dto.promptTemplate,
      variables: variableEntries,
      sharedVariables: sharedVars.map((v) => ({ key: v.key, value: v.value })),
      builtIns: {
        'repo.owner': 'sample-owner',
        'repo.name': 'sample-repo',
        'repo.full_name': 'sample-owner/sample-repo',
        timestamp: new Date().toISOString(),
        'automation.name': automation.name,
      },
    });

    return { resolvedPrompt, variables };
  }

  private buildUpdateData({ dto }: { dto: AutomationUpdateDto }): Partial<{
    name: string;
    description: string | null;
    triggerType: 'event' | 'cron' | 'manual';
    triggerConfig: Record<string, unknown>;
    promptTemplate: string;
    provider: string;
    model: string | null;
    enabled: boolean;
  }> {
    const data: Partial<{
      name: string;
      description: string | null;
      triggerType: 'event' | 'cron' | 'manual';
      triggerConfig: Record<string, unknown>;
      promptTemplate: string;
      provider: string;
      model: string | null;
      enabled: boolean;
    }> = {};
    if (dto.name !== undefined)
      data.name = this.sanitization.sanitizeForStorage({
        input: dto.name,
        maxLength: 255,
      });
    if (dto.description !== undefined)
      data.description = dto.description
        ? this.sanitization.sanitizeForStorage({ input: dto.description })
        : dto.description;
    if (dto.promptTemplate !== undefined) data.promptTemplate = dto.promptTemplate;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.model !== undefined) data.model = dto.model ?? null;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.triggerType !== undefined) data.triggerType = dto.triggerType;
    if (dto.triggerConfig !== undefined) data.triggerConfig = dto.triggerConfig;
    return data;
  }

  private validateProviderAndModel({
    provider,
    model,
  }: {
    provider: string;
    model?: string | null;
  }): void {
    this.providersRegistry.getByIdOrThrow(provider);
    if (model && !this.providersRegistry.validateModel({ providerId: provider, modelId: model })) {
      throw new BadRequestException(`Model "${model}" is not valid for provider "${provider}"`);
    }
  }

  private validateTriggerConfig({
    triggerType,
    triggerConfig,
  }: {
    triggerType: 'event' | 'cron' | 'manual';
    triggerConfig: Record<string, unknown>;
  }): void {
    switch (triggerType) {
      case 'event':
        this.triggerValidation.validateEventConfig({
          config: asEventConfig(triggerConfig),
        });
        break;
      case 'cron':
        this.triggerValidation.validateCronConfig({
          config: asCronConfig(triggerConfig),
        });
        break;
      case 'manual':
        this.triggerValidation.validateManualConfig({
          config: triggerConfig,
        });
        break;
    }
  }

  private async handleCronChanges({
    existing,
    updated,
    dto,
  }: {
    existing: AutomationWithVariables;
    updated: typeof automations.$inferSelect;
    dto: AutomationUpdateDto;
  }): Promise<void> {
    const wasCron = existing.triggerType === 'cron';
    const isCron = updated.triggerType === 'cron';

    if (wasCron && !isCron) {
      await this.cronScheduler.unregisterCron({
        automationId: updated.id,
      });
      return;
    }

    if (!wasCron && isCron && updated.enabled) {
      const config = asCronConfig(updated.triggerConfig as Record<string, unknown>);
      await this.cronScheduler.registerCron({
        automationId: updated.id,
        schedule: config.schedule,
        timezone: config.timezone,
      });
      return;
    }

    if (wasCron && isCron && dto.triggerConfig && updated.enabled) {
      const config = asCronConfig(updated.triggerConfig as Record<string, unknown>);
      await this.cronScheduler.updateCron({
        automationId: updated.id,
        schedule: config.schedule,
        timezone: config.timezone,
      });
    }
  }
}
