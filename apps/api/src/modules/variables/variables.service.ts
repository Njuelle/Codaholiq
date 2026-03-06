import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { VariablesRepository } from './variables.repository';
import { GitHubEntityRepository } from '../github/github-entity.repository';
import { SanitizationService } from '../../common/sanitization/sanitization.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import type { CreateVariableDto } from './dto/create-variable.dto';
import type { UpdateVariableDto } from './dto/update-variable.dto';
import { sharedVariables } from './variables.schema';

const SECRET_MASK = '••••••••';

type VariableRow = typeof sharedVariables.$inferSelect;

@Injectable()
export class VariablesService {
  constructor(
    @Inject(VariablesRepository)
    private readonly variablesRepository: VariablesRepository,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
    @Inject(SanitizationService)
    private readonly sanitization: SanitizationService,
    @Inject(EncryptionService)
    private readonly encryption: EncryptionService,
  ) {}

  async list({ orgId }: { orgId: number }): Promise<VariableRow[]> {
    const rows = await this.variablesRepository.findByOrgId({ orgId });
    return rows.map((row) => (row.isSecret ? { ...row, value: SECRET_MASK } : row));
  }

  async create({ orgId, dto }: { orgId: number; dto: CreateVariableDto }): Promise<VariableRow> {
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

    const storedValue = dto.isSecret
      ? this.encryption.encrypt({ plaintext: sanitizedValue })
      : sanitizedValue;

    try {
      const row = await this.variablesRepository.create({
        orgId,
        repoId: dto.repoId ?? null,
        key: sanitizedKey,
        value: storedValue,
        isSecret: dto.isSecret ?? false,
        description: sanitizedDescription,
      });
      return row.isSecret ? { ...row, value: SECRET_MASK } : row;
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
  }): Promise<VariableRow> {
    const existing = await this.variablesRepository.findById({
      id: variableId,
      orgId,
    });
    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const data: { value?: string; description?: string | null } = {};

    if (dto.value !== undefined) {
      const sanitizedValue = this.sanitization.sanitizeForStorage({
        input: dto.value,
        maxLength: 10000,
      });
      data.value = existing.isSecret
        ? this.encryption.encrypt({ plaintext: sanitizedValue })
        : sanitizedValue;
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

    return updated.isSecret ? { ...updated, value: SECRET_MASK } : updated;
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
  }): Promise<VariableRow[]> {
    const rows = await this.variablesRepository.findForResolution({ orgId, repoId });
    return rows.map((row) =>
      row.isSecret ? { ...row, value: this.encryption.decrypt({ encrypted: row.value }) } : row,
    );
  }
}
