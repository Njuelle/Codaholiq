import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../permissions/permissions.constants';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AutomationService } from './automations.service';
import { AutomationCreateSchema, AutomationCreateDto } from './dto/create-automation.dto';
import {
  CreateFromTemplateSchema,
  CreateFromTemplateDto,
} from './dto/create-from-template.dto';
import { AutomationUpdateSchema, AutomationUpdateDto } from './dto/update-automation.dto';
import { ManualTriggerSchema, ManualTriggerDto } from './dto/manual-trigger.dto';
import { ValidatePromptSchema, ValidatePromptDto } from './dto/validate-prompt.dto';
import { SetEnabledSchema, SetEnabledDto } from './dto/set-enabled.dto';
import { ListAutomationsQuerySchema, ListAutomationsQuery } from './dto/list-automations.dto';
import type { JwtPayload } from '../auth/dto/auth.dto';
import type { AutomationWithVariables } from './automations.types';
import { automations } from './automations.schema';

@Controller('orgs/:orgId/automations')
@UseGuards(OrgGuard, PermissionGuard)
export class AutomationsController {
  constructor(
    @Inject(AutomationService)
    private readonly automationService: AutomationService,
  ) {}

  @Post()
  @RequirePermission(Permission.AUTOMATIONS_CREATE)
  @Audit({ action: 'automation.created', resourceType: 'automation' })
  async create(
    @Param('orgId', ParseIntPipe) orgId: number,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(AutomationCreateSchema))
    dto: AutomationCreateDto,
  ): Promise<AutomationWithVariables> {
    return this.automationService.create({
      orgId,
      userId: user.sub,
      dto,
    });
  }

  @Post('from-template')
  @RequirePermission(Permission.AUTOMATIONS_CREATE)
  @Audit({ action: 'automation.created', resourceType: 'automation' })
  async createFromTemplate(
    @Param('orgId', ParseIntPipe) orgId: number,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateFromTemplateSchema))
    dto: CreateFromTemplateDto,
  ): Promise<AutomationWithVariables> {
    return this.automationService.createFromTemplate({
      orgId,
      userId: user.sub,
      templateSlug: dto.templateSlug,
      repoId: dto.repoId,
    });
  }

  @Get()
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(ListAutomationsQuerySchema))
    query: ListAutomationsQuery,
  ): Promise<(typeof automations.$inferSelect)[]> {
    return this.automationService.list({
      orgId,
      filters: {
        triggerType: query.triggerType,
        enabled: query.enabled,
        repoId: query.repoId,
        limit: query.limit,
        offset: query.offset,
      },
    });
  }

  @Get(':automationId')
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async findById(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
  ): Promise<AutomationWithVariables> {
    return this.automationService.findById({
      orgId,
      automationId,
    });
  }

  @Patch(':automationId')
  @RequirePermission(Permission.AUTOMATIONS_EDIT)
  @Audit({
    action: 'automation.updated',
    resourceType: 'automation',
    resourceIdParam: 'automationId',
  })
  async update(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
    @Body(new ZodValidationPipe(AutomationUpdateSchema))
    dto: AutomationUpdateDto,
  ): Promise<typeof automations.$inferSelect> {
    return this.automationService.update({
      orgId,
      automationId,
      dto,
    });
  }

  @Delete(':automationId')
  @RequirePermission(Permission.AUTOMATIONS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'automation.deleted',
    resourceType: 'automation',
    resourceIdParam: 'automationId',
  })
  async delete(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
  ): Promise<void> {
    await this.automationService.delete({ orgId, automationId });
  }

  @Patch(':automationId/enabled')
  @RequirePermission(Permission.AUTOMATIONS_TOGGLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'automation.enabled',
    resourceType: 'automation',
    resourceIdParam: 'automationId',
  })
  async setEnabled(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
    @Body(new ZodValidationPipe(SetEnabledSchema)) dto: SetEnabledDto,
  ): Promise<void> {
    await this.automationService.setEnabled({
      orgId,
      automationId,
      enabled: dto.enabled,
    });
  }

  @Post(':automationId/trigger')
  @RequirePermission(Permission.AUTOMATIONS_EDIT)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Audit({
    action: 'automation.triggered',
    resourceType: 'automation',
    resourceIdParam: 'automationId',
  })
  async triggerManual(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ManualTriggerSchema)) dto: ManualTriggerDto,
  ): Promise<{ executionId: number; status: string }> {
    const execution = await this.automationService.triggerManual({
      orgId,
      automationId,
      userId: user.sub,
      variableOverrides: dto.variables,
    });
    return { executionId: execution.id, status: execution.status };
  }

  @Post(':automationId/validate-prompt')
  @RequirePermission(Permission.AUTOMATIONS_VIEW)
  @HttpCode(HttpStatus.OK)
  async validatePrompt(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('automationId', ParseIntPipe) automationId: number,
    @Body(new ZodValidationPipe(ValidatePromptSchema)) dto: ValidatePromptDto,
  ): Promise<{ resolvedPrompt: string; variables: string[] }> {
    return this.automationService.validatePrompt({ orgId, automationId, dto });
  }
}
