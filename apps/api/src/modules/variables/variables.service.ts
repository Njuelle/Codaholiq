import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { VariablesRepository } from './variables.repository';
import { GitHubEntityRepository } from '../github/github-entity.repository';
import { SanitizationService } from '../../common/sanitization/sanitization.service';
import type { CreateVariableDto } from './dto/create-variable.dto';
import type { UpdateVariableDto } from './dto/update-variable.dto';
import { sharedVariables } from './variables.schema';

@Injectable()
export class VariablesService {
  constructor(
    @Inject(VariablesRepository)
    private readonly variablesRepository: VariablesRepository,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
    @Inject(SanitizationService)
    private readonly sanitization: SanitizationService,
  ) {}

  async list({ orgId }: { orgId: number }): Promise<(typeof sharedVariables.$inferSelect)[]> {
    return this.variablesRepository.findByOrgId({ orgId });
  }

  async create({
    orgId,
    dto,
  }: {
    orgId: number;
    dto: CreateVariableDto;
  }): Promise<typeof sharedVariables.$inferSelect> {
    if (dto.repoId) {
      const repo = await this.githubEntityRepository.findRepositoryById({
        id: dto.repoId,
      });
      if (!repo || repo.orgId !== orgId) {
        throw new NotFoundException('Repository not found');
      }
    }

    const sanitizedKey = this.sanitization.sanitizeForStorage({
      input: dto.key,
      maxLength: 100,
    });
    const sanitizedValue = this.sanitization.sanitizeForStorage({
      input: dto.value,
      maxLength: 10000,
    });
    const sanitizedDescription = dto.description
      ? this.sanitization.sanitizeForStorage({
          input: dto.description,
          maxLength: 500,
        })
      : undefined;

    try {
      return await this.variablesRepository.create({
        orgId,
        repoId: dto.repoId ?? null,
        key: sanitizedKey,
        value: sanitizedValue,
        description: sanitizedDescription,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(
          `Variable with key "${sanitizedKey}" already exists in this scope`,
        );
      }
      throw error;
    }
  }

  async update({
    orgId,
    variableId,
    dto,
  }: {
    orgId: number;
    variableId: number;
    dto: UpdateVariableDto;
  }): Promise<typeof sharedVariables.$inferSelect> {
    const data: { value?: string; description?: string | null } = {};

    if (dto.value !== undefined) {
      data.value = this.sanitization.sanitizeForStorage({
        input: dto.value,
        maxLength: 10000,
      });
    }

    if (dto.description !== undefined) {
      data.description =
        dto.description === null
          ? null
          : this.sanitization.sanitizeForStorage({
              input: dto.description,
              maxLength: 500,
            });
    }

    const updated = await this.variablesRepository.update({
      id: variableId,
      orgId,
      data,
    });

    if (!updated) {
      throw new NotFoundException('Variable not found');
    }

    return updated;
  }

  async delete({ orgId, variableId }: { orgId: number; variableId: number }): Promise<void> {
    const existing = await this.variablesRepository.findById({
      id: variableId,
      orgId,
    });
    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    await this.variablesRepository.delete({ id: variableId, orgId });
  }

  async findForResolution({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<(typeof sharedVariables.$inferSelect)[]> {
    return this.variablesRepository.findForResolution({ orgId, repoId });
  }
}
