import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../permissions/permissions.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RepositoriesService } from './repositories.service';
import { ListReposQuerySchema, ListReposQuery } from './dto/list-repos.dto';
import { UpdateRepoSchema, UpdateRepoDto } from './dto/update-repo.dto';
import { repositories } from './github.schema';

// Permission mapping: repos are viewed in the context of automations (AUTOMATIONS_VIEW)
// and managed as org-level infrastructure (ORG_SETTINGS_EDIT).
@Controller('orgs/:orgId/repos')
@UseGuards(OrgGuard, PermissionGuard)
export class RepositoriesController {
  constructor(
    @Inject(RepositoriesService)
    private readonly repoService: RepositoriesService,
  ) {}

  @Get()
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(ListReposQuerySchema)) query: ListReposQuery,
  ): Promise<{
    items: (typeof repositories.$inferSelect)[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const { items, total } = await this.repoService.list({ orgId, filters: query });
    return {
      items,
      meta: {
        total,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
    };
  }

  @Get(':repoId/setup-status')
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  async getSetupStatus(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
  ): Promise<{
    workflowFileExists: boolean;
    secretsConfigured: boolean;
    hasAnthropicKey: boolean;
    hasOAuthToken: boolean;
  }> {
    return this.repoService.getSetupStatus({ orgId, repoId });
  }

  @Post(':repoId/setup-workflow')
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  @HttpCode(HttpStatus.CREATED)
  async setupWorkflowPR(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
  ): Promise<{ pullRequestUrl: string }> {
    return this.repoService.setupWorkflowPR({ orgId, repoId });
  }

  @Get(':repoId')
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  async findById(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
  ): Promise<{
    repo: typeof repositories.$inferSelect;
    automationCount: number;
  }> {
    return this.repoService.findById({ orgId, repoId });
  }

  @Post('sync')
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  @HttpCode(HttpStatus.OK)
  async sync(@Param('orgId', ParseIntPipe) orgId: number): Promise<{ synced: number }> {
    return this.repoService.triggerSync({ orgId });
  }

  @Patch(':repoId')
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  async updateWebhookActive(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body(new ZodValidationPipe(UpdateRepoSchema)) dto: UpdateRepoDto,
  ): Promise<typeof repositories.$inferSelect> {
    return this.repoService.updateWebhookActive({
      orgId,
      repoId,
      active: dto.webhookActive,
    });
  }
}
