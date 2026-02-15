import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { CurrentOrgMember } from '../../common/decorators/current-org-member.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PermissionsService } from './permissions.service';
import {
  UpdateRolePermissionsSchema,
  UpdateRolePermissionsDto,
} from './dto/update-role-permissions.dto';
import type { Permission } from './permissions.constants';

@Controller('orgs/:orgId/permissions')
@UseGuards(OrgGuard)
export class PermissionsController {
  constructor(
    @Inject(PermissionsService)
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('me')
  async getMyPermissions(
    @CurrentOrgMember()
    orgMember: {
      orgId: number;
      userId: number;
      role: 'owner' | 'admin' | 'member';
    },
  ): Promise<{ role: string; permissions: readonly Permission[] }> {
    return this.permissionsService.getMyPermissions({
      orgId: orgMember.orgId,
      role: orgMember.role,
    });
  }

  // Owner-only by role check (not @RequirePermission) — the ability to manage
  // permissions is inherently owner-only and cannot be delegated via the permission system itself.
  @Get()
  async getAllRolePermissions(
    @CurrentOrgMember()
    orgMember: {
      orgId: number;
      userId: number;
      role: 'owner' | 'admin' | 'member';
    },
  ): Promise<Record<'owner' | 'admin' | 'member', readonly Permission[]>> {
    if (orgMember.role !== 'owner') {
      throw new ForbiddenException('Only owners can view all role permissions');
    }
    return this.permissionsService.getAllRolePermissions({
      orgId: orgMember.orgId,
    });
  }

  @Put(':role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRolePermissions(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('role') role: string,
    @CurrentOrgMember()
    orgMember: { orgId: number; userId: number; role: 'owner' | 'admin' | 'member' },
    @Body(new ZodValidationPipe(UpdateRolePermissionsSchema))
    dto: UpdateRolePermissionsDto,
  ): Promise<void> {
    await this.permissionsService.updateRolePermissions({
      orgId,
      role,
      permissions: dto.permissions,
      requestingRole: orgMember.role,
    });
  }
}
