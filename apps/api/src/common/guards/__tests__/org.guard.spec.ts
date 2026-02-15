import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrgGuard } from '../org.guard';
import { OrganizationsRepository } from '../../../modules/organizations/organizations.repository';

function createMockContext({
  orgId,
  user,
}: {
  orgId?: string;
  user?: { sub: number; username: string };
}): ExecutionContext {
  const request: Record<string, unknown> = {
    params: { orgId },
    user,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OrgGuard', () => {
  let guard: OrgGuard;
  let orgRepository: { getMemberRole: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    orgRepository = { getMemberRole: vi.fn() };
    guard = new OrgGuard(orgRepository as unknown as OrganizationsRepository);
  });

  it('should reject invalid orgId', async () => {
    const context = createMockContext({ orgId: 'abc', user: { sub: 1, username: 'u' } });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should reject unauthenticated requests', async () => {
    const context = createMockContext({ orgId: '1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should reject non-members', async () => {
    orgRepository.getMemberRole.mockResolvedValue(null);
    const context = createMockContext({ orgId: '1', user: { sub: 1, username: 'u' } });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow members and attach orgMember to request', async () => {
    orgRepository.getMemberRole.mockResolvedValue('admin');
    const context = createMockContext({ orgId: '5', user: { sub: 2, username: 'u' } });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.orgMember).toEqual({ orgId: 5, userId: 2, role: 'admin' });
  });
});
