import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../permission.guard';
import { PermissionsService } from '../../../modules/permissions/permissions.service';
import { Permission } from '../../../modules/permissions/permissions.constants';

function createMockContext({
  orgMember,
  handler = vi.fn(),
  classRef = vi.fn(),
}: {
  orgMember?: { orgId: number; userId: number; role: 'owner' | 'admin' | 'member' };
  handler?: () => void;
  classRef?: () => void;
}): ExecutionContext {
  const request: Record<string, unknown> = { orgMember };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => classRef,
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let mockPermissionsService: {
    resolvePermissions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reflector = new Reflector();
    mockPermissionsService = {
      resolvePermissions: vi
        .fn()
        .mockResolvedValue([Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW]),
    };
    guard = new PermissionGuard(reflector, mockPermissionsService as unknown as PermissionsService);
  });

  it('should allow access and still resolve permissions when no @RequirePermission() is set', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPermissionsService.resolvePermissions).toHaveBeenCalledWith({
      orgId: 1,
      role: 'member',
    });
    const request = context.switchToHttp().getRequest<Express.Request>();
    expect(request.orgMember?.permissions).toEqual([
      Permission.AUTOMATIONS_VIEW,
      Permission.EXECUTIONS_VIEW,
    ]);
  });

  it('should allow access when empty permissions array is required', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has the required permission', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.AUTOMATIONS_VIEW]);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user lacks the required permission', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.AUTOMATIONS_CREATE]);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access when user has some but not all required permissions', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      Permission.AUTOMATIONS_VIEW,
      Permission.AUTOMATIONS_CREATE,
    ]);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access when orgMember is not set and permissions are required', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.AUTOMATIONS_VIEW]);
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when orgMember is not set and no permissions are required', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPermissionsService.resolvePermissions).not.toHaveBeenCalled();
  });

  it('should use generic error message when permissions are missing', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      Permission.AUTOMATIONS_CREATE,
      Permission.AUTOMATIONS_DELETE,
    ]);
    const context = createMockContext({
      orgMember: { orgId: 1, userId: 1, role: 'member' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Insufficient permissions for this action',
    );
  });

  it('should attach effective permissions to request.orgMember', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.AUTOMATIONS_VIEW]);
    const orgMember = { orgId: 1, userId: 1, role: 'member' as const };
    const context = createMockContext({ orgMember });

    await guard.canActivate(context);

    const request = context.switchToHttp().getRequest<Express.Request>();
    expect(request.orgMember?.permissions).toEqual([
      Permission.AUTOMATIONS_VIEW,
      Permission.EXECUTIONS_VIEW,
    ]);
  });

  it('should call resolvePermissions with correct orgId and role', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.AUTOMATIONS_VIEW]);
    const context = createMockContext({
      orgMember: { orgId: 42, userId: 7, role: 'admin' },
    });

    await guard.canActivate(context);

    expect(mockPermissionsService.resolvePermissions).toHaveBeenCalledWith({
      orgId: 42,
      role: 'admin',
    });
  });
});
