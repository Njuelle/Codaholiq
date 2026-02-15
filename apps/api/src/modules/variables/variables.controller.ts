import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { VariablesService } from './variables.service';
import { CreateVariableSchema, CreateVariableDto } from './dto/create-variable.dto';
import { UpdateVariableSchema, UpdateVariableDto } from './dto/update-variable.dto';
import { sharedVariables } from './variables.schema';

@Controller('orgs/:orgId/variables')
@UseGuards(OrgGuard, PermissionGuard)
export class VariablesController {
  constructor(
    @Inject(VariablesService)
    private readonly variablesService: VariablesService,
  ) {}

  @Get()
  @RequirePermission(Permission.ORG_SETTINGS_VIEW)
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
  ): Promise<(typeof sharedVariables.$inferSelect)[]> {
    return this.variablesService.list({ orgId });
  }

  @Post()
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  async create(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body(new ZodValidationPipe(CreateVariableSchema))
    dto: CreateVariableDto,
  ): Promise<typeof sharedVariables.$inferSelect> {
    return this.variablesService.create({ orgId, dto });
  }

  @Patch(':variableId')
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  async update(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('variableId', ParseIntPipe) variableId: number,
    @Body(new ZodValidationPipe(UpdateVariableSchema))
    dto: UpdateVariableDto,
  ): Promise<typeof sharedVariables.$inferSelect> {
    return this.variablesService.update({ orgId, variableId, dto });
  }

  @Delete(':variableId')
  @RequirePermission(Permission.ORG_SETTINGS_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('variableId', ParseIntPipe) variableId: number,
  ): Promise<void> {
    return this.variablesService.delete({ orgId, variableId });
  }
}
