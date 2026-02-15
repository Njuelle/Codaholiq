import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { PermissionsService } from '../permissions.service';
import { PermissionsRepository } from '../permissions.repository';
import { Permission, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../permissions.constants';

function createMockRepository(): Record<
  keyof Pick<
    PermissionsRepository,
    'findByOrgAndRole' | 'findAllByOrg' | 'upsertForOrgAndRole' | 'deleteByOrg'
  >,
  ReturnType<typeof vi.fn>
> {
  return {
    findByOrgAndRole: vi.fn().mockResolvedValue(undefined),
    findAllByOrg: vi.fn().mockResolvedValue([]),
    upsertForOrgAndRole: vi.fn().mockResolvedValue({
      id: 1,
      orgId: 1,
      role: 'admin',
      permissions: [],
      updatedAt: new Date(),
    }),
    deleteByOrg: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new PermissionsService(mockRepository as unknown as PermissionsRepository);
  });

  describe('resolvePermissions', () => {
    it('should always return ALL_PERMISSIONS for owner role', async () => {
      const result = await service.resolvePermissions({
        orgId: 1,
        role: 'owner',
      });

      expect(result).toEqual(ALL_PERMISSIONS);
      expect(mockRepository.findByOrgAndRole).not.toHaveBeenCalled();
    });

    it('should return default permissions for admin when no override exists', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      const result = await service.resolvePermissions({
        orgId: 1,
        role: 'admin',
      });

      expect(result).toEqual(DEFAULT_ROLE_PERMISSIONS.admin);
    });

    it('should return default permissions for member when no override exists', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      const result = await service.resolvePermissions({
        orgId: 1,
        role: 'member',
      });

      expect(result).toEqual(DEFAULT_ROLE_PERMISSIONS.member);
    });

    it('should return custom permissions when override exists', async () => {
      const customPermissions = [Permission.AUTOMATIONS_VIEW, Permission.AUTOMATIONS_CREATE];
      mockRepository.findByOrgAndRole.mockResolvedValue({
        id: 1,
        orgId: 1,
        role: 'admin',
        permissions: customPermissions,
        updatedAt: new Date(),
      });

      const result = await service.resolvePermissions({
        orgId: 1,
        role: 'admin',
      });

      expect(result).toEqual(customPermissions);
    });

    it('should cache permissions and not query DB on second call', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      await service.resolvePermissions({ orgId: 1, role: 'admin' });
      await service.resolvePermissions({ orgId: 1, role: 'admin' });

      expect(mockRepository.findByOrgAndRole).toHaveBeenCalledTimes(1);
    });

    it('should use separate cache entries per role', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      await service.resolvePermissions({ orgId: 1, role: 'admin' });
      await service.resolvePermissions({ orgId: 1, role: 'member' });

      expect(mockRepository.findByOrgAndRole).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMyPermissions', () => {
    it('should return role and permissions', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      const result = await service.getMyPermissions({
        orgId: 1,
        role: 'admin',
      });

      expect(result.role).toBe('admin');
      expect(result.permissions).toEqual(DEFAULT_ROLE_PERMISSIONS.admin);
    });
  });

  describe('getAllRolePermissions', () => {
    it('should return permissions for all three roles', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      const result = await service.getAllRolePermissions({ orgId: 1 });

      expect(result.owner).toEqual(ALL_PERMISSIONS);
      expect(result.admin).toEqual(DEFAULT_ROLE_PERMISSIONS.admin);
      expect(result.member).toEqual(DEFAULT_ROLE_PERMISSIONS.member);
    });
  });

  describe('updateRolePermissions', () => {
    it('should update permissions for admin role', async () => {
      const newPermissions = [Permission.AUTOMATIONS_VIEW];

      await service.updateRolePermissions({
        orgId: 1,
        role: 'admin',
        permissions: newPermissions,
        requestingRole: 'owner',
      });

      expect(mockRepository.upsertForOrgAndRole).toHaveBeenCalledWith({
        orgId: 1,
        role: 'admin',
        permissions: newPermissions,
      });
    });

    it('should reject non-owner from updating permissions', async () => {
      await expect(
        service.updateRolePermissions({
          orgId: 1,
          role: 'member',
          permissions: [Permission.AUTOMATIONS_VIEW],
          requestingRole: 'admin',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject updating owner permissions', async () => {
      await expect(
        service.updateRolePermissions({
          orgId: 1,
          role: 'owner',
          permissions: [Permission.AUTOMATIONS_VIEW],
          requestingRole: 'owner',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid role', async () => {
      await expect(
        service.updateRolePermissions({
          orgId: 1,
          role: 'superadmin',
          permissions: [Permission.AUTOMATIONS_VIEW],
          requestingRole: 'owner',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid permission strings', async () => {
      await expect(
        service.updateRolePermissions({
          orgId: 1,
          role: 'admin',
          permissions: ['invalid.permission'],
          requestingRole: 'owner',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should invalidate cache after update', async () => {
      mockRepository.findByOrgAndRole.mockResolvedValue(undefined);

      await service.resolvePermissions({ orgId: 1, role: 'admin' });
      expect(mockRepository.findByOrgAndRole).toHaveBeenCalledTimes(1);

      await service.updateRolePermissions({
        orgId: 1,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW],
        requestingRole: 'owner',
      });

      await service.resolvePermissions({ orgId: 1, role: 'admin' });
      expect(mockRepository.findByOrgAndRole).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetOrgPermissions', () => {
    it('should delete all overrides for the org', async () => {
      await service.resetOrgPermissions({
        orgId: 1,
        requestingRole: 'owner',
      });

      expect(mockRepository.deleteByOrg).toHaveBeenCalledWith({ orgId: 1 });
    });

    it('should reject non-owner from resetting', async () => {
      await expect(
        service.resetOrgPermissions({
          orgId: 1,
          requestingRole: 'admin',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
