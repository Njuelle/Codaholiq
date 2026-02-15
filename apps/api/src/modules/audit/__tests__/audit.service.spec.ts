import { AuditService } from '../audit.service';
import { AuditRepository } from '../audit.repository';
import { SecretMaskingService } from '../../../common/crypto/secret-masking.service';

function createMockRepository(): Record<keyof AuditRepository, ReturnType<typeof vi.fn>> {
  return {
    create: vi.fn().mockResolvedValue({
      id: 1,
      orgId: 1,
      userId: 1,
      action: 'automation.created',
      resourceType: 'automation',
      resourceId: '42',
      details: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    }),
    findByOrgId: vi.fn().mockResolvedValue([]),
    countByOrgId: vi.fn().mockResolvedValue(0),
    deleteOlderThan: vi.fn().mockResolvedValue(0),
  };
}

function createMockSecretMasking(): Record<keyof SecretMaskingService, ReturnType<typeof vi.fn>> {
  return {
    mask: vi.fn().mockImplementation(({ text }: { text: string }) => text),
    maskObject: vi.fn().mockImplementation(({ obj }: { obj: Record<string, unknown> }) => obj),
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockMasking: ReturnType<typeof createMockSecretMasking>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockMasking = createMockSecretMasking();
    service = new AuditService(
      mockRepository as unknown as AuditRepository,
      mockMasking as unknown as SecretMaskingService,
    );
  });

  describe('log', () => {
    it('should call repository.create fire-and-forget', () => {
      service.log({
        orgId: 1,
        userId: 2,
        action: 'automation.created',
        resourceType: 'automation',
        resourceId: '42',
        details: { name: 'My Automation' },
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
      });

      // fire-and-forget: must have been called
      expect(mockRepository.create).toHaveBeenCalledWith({
        orgId: 1,
        userId: 2,
        action: 'automation.created',
        resourceType: 'automation',
        resourceId: '42',
        details: { name: 'My Automation' },
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
      });
    });

    it('should mask details before storing', () => {
      const details = { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.signature' };
      mockMasking.maskObject.mockReturnValue({ token: '[REDACTED]' });

      service.log({
        action: 'auth.login',
        resourceType: 'session',
        details,
      });

      expect(mockMasking.maskObject).toHaveBeenCalledWith({ obj: details });
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { token: '[REDACTED]' },
        }),
      );
    });

    it('should not call maskObject when details is null', () => {
      service.log({
        action: 'automation.deleted',
        resourceType: 'automation',
        resourceId: '1',
      });

      expect(mockMasking.maskObject).not.toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ details: null }),
      );
    });

    it('should not throw when repository.create fails', async () => {
      mockRepository.create.mockRejectedValue(new Error('DB connection failed'));

      // Should not throw
      service.log({
        action: 'automation.created',
        resourceType: 'automation',
      });

      // Give the promise time to reject
      await new Promise((resolve) => setTimeout(resolve, 10));
      // If we get here without an unhandled rejection, the test passes
    });
  });

  describe('findByOrgId', () => {
    it('should return items and total count', async () => {
      const mockItems = [
        {
          id: 1,
          orgId: 1,
          userId: 1,
          action: 'automation.created' as const,
          resourceType: 'automation',
          resourceId: '42',
          details: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
        },
      ];
      mockRepository.findByOrgId.mockResolvedValue(mockItems);
      mockRepository.countByOrgId.mockResolvedValue(1);

      const result = await service.findByOrgId({
        orgId: 1,
        limit: 50,
        offset: 0,
      });

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(1);
    });

    it('should pass all filters to repository', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      await service.findByOrgId({
        orgId: 1,
        action: 'automation.created',
        userId: 2,
        resourceType: 'automation',
        from,
        to,
        limit: 25,
        offset: 10,
      });

      expect(mockRepository.findByOrgId).toHaveBeenCalledWith({
        orgId: 1,
        action: 'automation.created',
        userId: 2,
        resourceType: 'automation',
        from,
        to,
        limit: 25,
        offset: 10,
      });
      expect(mockRepository.countByOrgId).toHaveBeenCalledWith({
        orgId: 1,
        action: 'automation.created',
        userId: 2,
        resourceType: 'automation',
        from,
        to,
      });
    });
  });
});
