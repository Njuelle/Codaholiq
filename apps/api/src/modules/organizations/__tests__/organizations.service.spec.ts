import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';
import type { OrganizationsRepository } from '../organizations.repository';
import type { AuthRepository } from '../../auth/auth.repository';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../../permissions/permissions.constants';

function createMockOrgRepository() {
  return {
    findOrgsByUserId: vi.fn().mockResolvedValue([]),
    findOrgById: vi.fn(),
    countMembers: vi.fn().mockResolvedValue(0),
    countMembersByRole: vi.fn().mockResolvedValue(0),
    listMembers: vi.fn().mockResolvedValue([]),
    getMemberRole: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn().mockResolvedValue(undefined),
    updateMemberRole: vi.fn().mockResolvedValue(undefined),
    createOrg: vi.fn(),
  };
}

function createMockAuthRepository() {
  return {
    findByUsername: vi.fn(),
  };
}

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgRepo: ReturnType<typeof createMockOrgRepository>;
  let authRepo: ReturnType<typeof createMockAuthRepository>;

  beforeEach(() => {
    orgRepo = createMockOrgRepository();
    authRepo = createMockAuthRepository();
    service = new OrganizationsService(
      orgRepo as unknown as OrganizationsRepository,
      authRepo as unknown as AuthRepository,
    );
  });

  describe('findOrgById', () => {
    it('should return org with member count', async () => {
      const org = { id: 1, name: 'Test', slug: 'test' };
      orgRepo.findOrgById.mockResolvedValue(org);
      orgRepo.countMembers.mockResolvedValue(3);

      const result = await service.findOrgById({ orgId: 1 });

      expect(result).toEqual({ org, memberCount: 3 });
    });

    it('should throw NotFoundException if org not found', async () => {
      orgRepo.findOrgById.mockResolvedValue(undefined);

      await expect(service.findOrgById({ orgId: 999 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('inviteMember', () => {
    it('should invite a user by username', async () => {
      authRepo.findByUsername.mockResolvedValue({ id: 5, username: 'newuser' });
      orgRepo.getMemberRole.mockResolvedValue(null);
      orgRepo.addMember.mockResolvedValue({
        orgId: 1,
        userId: 5,
        role: 'member',
      });

      const result = await service.inviteMember({
        orgId: 1,
        dto: { username: 'newuser', role: 'member' },
      });

      expect(result.userId).toBe(5);
      expect(orgRepo.addMember).toHaveBeenCalledWith({
        orgId: 1,
        userId: 5,
        role: 'member',
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      authRepo.findByUsername.mockResolvedValue(undefined);

      await expect(
        service.inviteMember({ orgId: 1, dto: { username: 'ghost', role: 'member' } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already a member', async () => {
      authRepo.findByUsername.mockResolvedValue({ id: 5 });
      orgRepo.getMemberRole.mockResolvedValue('member');

      await expect(
        service.inviteMember({ orgId: 1, dto: { username: 'existing', role: 'member' } }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      orgRepo.getMemberRole.mockResolvedValue('member');

      await service.updateMemberRole({
        orgId: 1,
        userId: 5,
        dto: { role: 'admin' },
      });

      expect(orgRepo.updateMemberRole).toHaveBeenCalledWith({
        orgId: 1,
        userId: 5,
        role: 'admin',
      });
    });

    it('should throw NotFoundException if member not found', async () => {
      orgRepo.getMemberRole.mockResolvedValue(null);

      await expect(
        service.updateMemberRole({ orgId: 1, userId: 999, dto: { role: 'admin' } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent demoting last owner', async () => {
      orgRepo.getMemberRole.mockResolvedValue('owner');
      orgRepo.countMembersByRole.mockResolvedValue(1);

      await expect(
        service.updateMemberRole({ orgId: 1, userId: 1, dto: { role: 'member' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow demoting owner when multiple owners exist', async () => {
      orgRepo.getMemberRole.mockResolvedValue('owner');
      orgRepo.countMembersByRole.mockResolvedValue(2);

      await service.updateMemberRole({
        orgId: 1,
        userId: 5,
        dto: { role: 'admin' },
      });

      expect(orgRepo.updateMemberRole).toHaveBeenCalledWith({
        orgId: 1,
        userId: 5,
        role: 'admin',
      });
    });
  });

  describe('removeMember', () => {
    it('should allow self-leave', async () => {
      orgRepo.getMemberRole.mockResolvedValue('member');

      await service.removeMember({
        orgId: 1,
        targetUserId: 5,
        requestingUserId: 5,
        requestingRole: 'member',
        requestingPermissions: [...DEFAULT_ROLE_PERMISSIONS.member],
      });

      expect(orgRepo.removeMember).toHaveBeenCalledWith({ orgId: 1, userId: 5 });
    });

    it('should allow owner to remove member', async () => {
      orgRepo.getMemberRole.mockResolvedValue('member');

      await service.removeMember({
        orgId: 1,
        targetUserId: 5,
        requestingUserId: 1,
        requestingRole: 'owner',
        requestingPermissions: [...ALL_PERMISSIONS],
      });

      expect(orgRepo.removeMember).toHaveBeenCalledWith({ orgId: 1, userId: 5 });
    });

    it('should prevent member without manage permission from removing others', async () => {
      await expect(
        service.removeMember({
          orgId: 1,
          targetUserId: 5,
          requestingUserId: 3,
          requestingRole: 'member',
          requestingPermissions: [...DEFAULT_ROLE_PERMISSIONS.member],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent removing last owner', async () => {
      orgRepo.getMemberRole.mockResolvedValue('owner');
      orgRepo.countMembersByRole.mockResolvedValue(1);

      await expect(
        service.removeMember({
          orgId: 1,
          targetUserId: 1,
          requestingUserId: 1,
          requestingRole: 'owner',
          requestingPermissions: [...ALL_PERMISSIONS],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent admin from removing owner', async () => {
      orgRepo.getMemberRole.mockResolvedValue('owner');
      orgRepo.countMembersByRole.mockResolvedValue(2);

      await expect(
        service.removeMember({
          orgId: 1,
          targetUserId: 5,
          requestingUserId: 3,
          requestingRole: 'admin',
          requestingPermissions: [...DEFAULT_ROLE_PERMISSIONS.admin],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-member', async () => {
      orgRepo.getMemberRole.mockResolvedValue(null);

      await expect(
        service.removeMember({
          orgId: 1,
          targetUserId: 999,
          requestingUserId: 1,
          requestingRole: 'owner',
          requestingPermissions: [...ALL_PERMISSIONS],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
