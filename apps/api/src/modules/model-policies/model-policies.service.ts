import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ModelPoliciesRepository, ModelPolicy } from './model-policies.repository';
import { ProvidersRegistry } from '../providers/providers.registry';
import type { SetModelPoliciesDto } from './dto/set-model-policies.dto';

export interface ModelPoliciesResult {
  readonly policies: readonly ModelPolicy[];
  readonly isRestricted: boolean;
}

@Injectable()
export class ModelPoliciesService {
  constructor(
    @Inject(ModelPoliciesRepository)
    private readonly repository: ModelPoliciesRepository,
    @Inject(ProvidersRegistry)
    private readonly providersRegistry: ProvidersRegistry,
  ) {}

  async getForRepo({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<ModelPoliciesResult> {
    const policies = await this.repository.findByRepoId({ orgId, repoId });
    return {
      policies,
      isRestricted: policies.length > 0,
    };
  }

  async setForRepo({
    orgId,
    repoId,
    dto,
    userId,
  }: {
    orgId: number;
    repoId: number;
    dto: SetModelPoliciesDto;
    userId: number;
  }): Promise<ModelPoliciesResult> {
    for (const entry of dto.policies) {
      const provider = this.providersRegistry.getById(entry.provider);
      if (!provider) {
        throw new BadRequestException(`Unknown provider: ${entry.provider}`);
      }
      if (
        !this.providersRegistry.validateModel({ providerId: entry.provider, modelId: entry.model })
      ) {
        throw new BadRequestException(
          `Invalid model "${entry.model}" for provider "${entry.provider}"`,
        );
      }
    }

    const policies = await this.repository.setForRepo({
      orgId,
      repoId,
      policies: dto.policies,
      createdBy: userId,
    });

    return {
      policies,
      isRestricted: policies.length > 0,
    };
  }

  async validateModelAllowed({
    orgId,
    repoId,
    provider,
    model,
  }: {
    orgId: number;
    repoId: number;
    provider: string;
    model: string;
  }): Promise<void> {
    const allowed = await this.repository.isModelAllowed({ orgId, repoId, provider, model });
    if (!allowed) {
      throw new BadRequestException(
        `Model "${model}" (provider: "${provider}") is not allowed on this repository. Contact an admin to update the model policy.`,
      );
    }
  }
}
