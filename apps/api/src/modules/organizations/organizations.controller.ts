import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
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
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrgMember } from '../../common/decorators/current-org-member.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { JwtPayload } from '../auth/dto/auth.dto';
import { OrganizationsService } from './organizations.service';
import { InviteMemberSchema, InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleSchema, UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { organizations, orgMembers } from './organizations.schema';

@Controller('orgs')
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly orgService: OrganizationsService,
  ) {}

  @Get()
  async listOrgs(@CurrentUser() user: JwtPayload): Promise<(typeof organizations.$inferSelect)[]> {
    return this.orgService.listOrgsForUser({ userId: user.sub });
  }

  @Get(':orgId')
  @UseGuards(OrgGuard)
  async findById(@Param('orgId', ParseIntPipe) orgId: number): Promise<{
    org: typeof organizations.$inferSelect;
    memberCount: number;
  }> {
    return this.orgService.findOrgById({ orgId });
  }

  @Get(':orgId/members')
  @UseGuards(OrgGuard, PermissionGuard)
  @RequirePermission(Permission.ORG_MEMBERS_VIEW)
  async listMembers(@Param('orgId', ParseIntPipe) orgId: number): Promise<
    {
      userId: number;
      role: 'owner' | 'admin' | 'member';
      joinedAt: Date;
      username: string;
      avatarUrl: string | null;
    }[]
  > {
    return this.orgService.listMembers({ orgId });
  }

  @Post(':orgId/members')
  @UseGuards(OrgGuard, PermissionGuard)
  @RequirePermission(Permission.ORG_MEMBERS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @Audit({ action: 'member.invited', resourceType: 'member' })
  async inviteMember(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body(new ZodValidationPipe(InviteMemberSchema)) dto: InviteMemberDto,
  ): Promise<typeof orgMembers.$inferSelect> {
    return this.orgService.inviteMember({ orgId, dto });
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(OrgGuard, PermissionGuard)
  @RequirePermission(Permission.ORG_MEMBERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'member.role_updated', resourceType: 'member', resourceIdParam: 'userId' })
  async updateMemberRole(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema)) dto: UpdateMemberRoleDto,
  ): Promise<void> {
    await this.orgService.updateMemberRole({ orgId, userId, dto });
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgGuard, PermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'member.removed', resourceType: 'member', resourceIdParam: 'userId' })
  async removeMember(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: JwtPayload,
    @CurrentOrgMember()
    orgMember: {
      orgId: number;
      userId: number;
      role: 'owner' | 'admin' | 'member';
      permissions?: readonly string[];
    },
  ): Promise<void> {
    await this.orgService.removeMember({
      orgId,
      targetUserId,
      requestingUserId: user.sub,
      requestingRole: orgMember.role,
      requestingPermissions: orgMember.permissions ?? [],
    });
  }
}
