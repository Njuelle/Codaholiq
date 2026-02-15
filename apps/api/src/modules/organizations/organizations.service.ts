import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import { AuthRepository } from '../auth/auth.repository';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Permission } from '../permissions/permissions.constants';
import { organizations, orgMembers } from './organizations.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository)
    private readonly orgRepository: OrganizationsRepository,
    @Inject(AuthRepository)
    private readonly authRepository: AuthRepository,
  ) {}

  async listOrgsForUser({
    userId,
  }: {
    userId: number;
  }): Promise<(typeof organizations.$inferSelect)[]> {
    return this.orgRepository.findOrgsByUserId({ userId });
  }

  async findOrgById({ orgId }: { orgId: number }): Promise<{
    org: typeof organizations.$inferSelect;
    memberCount: number;
  }> {
    const org = await this.orgRepository.findOrgById({ id: orgId });
    if (!org) throw new NotFoundException('Organization not found');

    const memberCount = await this.orgRepository.countMembers({ orgId });
    return { org, memberCount };
  }

  async listMembers({ orgId }: { orgId: number }): Promise<
    {
      userId: number;
      role: 'owner' | 'admin' | 'member';
      joinedAt: Date;
      username: string;
      avatarUrl: string | null;
    }[]
  > {
    return this.orgRepository.listMembers({ orgId });
  }

  async inviteMember({
    orgId,
    dto,
  }: {
    orgId: number;
    dto: InviteMemberDto;
  }): Promise<typeof orgMembers.$inferSelect> {
    const user = await this.authRepository.findByUsername({ username: dto.username });
    if (!user) throw new NotFoundException('User not found');

    const existingRole = await this.orgRepository.getMemberRole({
      orgId,
      userId: user.id,
    });
    if (existingRole) throw new ConflictException('User is already a member');

    return this.orgRepository.addMember({
      orgId,
      userId: user.id,
      role: dto.role ?? 'member',
    });
  }

  async updateMemberRole({
    orgId,
    userId,
    dto,
  }: {
    orgId: number;
    userId: number;
    dto: UpdateMemberRoleDto;
  }): Promise<void> {
    const currentRole = await this.orgRepository.getMemberRole({ orgId, userId });
    if (!currentRole) throw new NotFoundException('Member not found');

    if (currentRole === 'owner' && dto.role !== 'owner') {
      const ownerCount = await this.orgRepository.countMembersByRole({
        orgId,
        role: 'owner',
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }

    await this.orgRepository.updateMemberRole({ orgId, userId, role: dto.role });
  }

  async removeMember({
    orgId,
    targetUserId,
    requestingUserId,
    requestingRole,
    requestingPermissions,
  }: {
    orgId: number;
    targetUserId: number;
    requestingUserId: number;
    requestingRole: 'owner' | 'admin' | 'member';
    requestingPermissions: readonly string[];
  }): Promise<void> {
    const isSelfLeave = targetUserId === requestingUserId;

    if (!isSelfLeave && !requestingPermissions.includes(Permission.ORG_MEMBERS_MANAGE)) {
      throw new ForbiddenException('You do not have permission to remove members');
    }

    const targetRole = await this.orgRepository.getMemberRole({
      orgId,
      userId: targetUserId,
    });
    if (!targetRole) throw new NotFoundException('Member not found');

    if (targetRole === 'owner') {
      const ownerCount = await this.orgRepository.countMembersByRole({
        orgId,
        role: 'owner',
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    if (!isSelfLeave && targetRole === 'owner' && requestingRole !== 'owner') {
      throw new ForbiddenException('Only owners can remove other owners');
    }

    await this.orgRepository.removeMember({ orgId, userId: targetUserId });
  }
}
