import { Controller, Get, Put, Body, Param, ParseIntPipe, Inject, UseGuards } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../permissions/permissions.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ModelPoliciesService, ModelPoliciesResult } from './model-policies.service';
import { SetModelPoliciesSchema, SetModelPoliciesDto } from './dto/set-model-policies.dto';
import type { JwtPayload } from '../auth/dto/auth.dto';

@Controller('orgs/:orgId/repos/:repoId/model-policies')
@UseGuards(OrgGuard, PermissionGuard)
export class ModelPoliciesController {
  constructor(
    @Inject(ModelPoliciesService)
    private readonly modelPoliciesService: ModelPoliciesService,
  ) {}

  @Get()
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  async get(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
  ): Promise<ModelPoliciesResult> {
    return this.modelPoliciesService.getForRepo({ orgId, repoId });
  }

  @Put()
  @RequirePermission(Permission.MODEL_POLICIES_MANAGE)
  async set(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('repoId', ParseIntPipe) repoId: number,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(SetModelPoliciesSchema))
    dto: SetModelPoliciesDto,
  ): Promise<ModelPoliciesResult> {
    return this.modelPoliciesService.setForRepo({
      orgId,
      repoId,
      dto,
      userId: user.sub,
    });
  }
}
