import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { OrganizationsRepository } from '../../organizations/organizations.repository';
import { SecretMaskingService } from '../../../common/crypto/secret-masking.service';

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    getdel: vi.fn().mockResolvedValue(null),
  };
}

function createMockAuthRepository(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    upsertUser: vi.fn(),
    findUserById: vi.fn(),
    findUserByGithubId: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
    withLockedRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
  };
}

function createMockOrgRepository(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    createOrg: vi.fn(),
    findOrgById: vi.fn(),
    findOrgBySlug: vi.fn(),
    findOrgsByUserId: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    getMemberRole: vi.fn(),
    updateMemberRole: vi.fn(),
    listMembers: vi.fn(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: ReturnType<typeof createMockAuthRepository>;
  let orgRepo: ReturnType<typeof createMockOrgRepository>;
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };
  let configService: { getOrThrow: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authRepo = createMockAuthRepository();
    orgRepo = createMockOrgRepository();
    jwtService = { signAsync: vi.fn().mockResolvedValue('mock-access-token') };
    configService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          GITHUB_CLIENT_ID: 'test-client-id',
          GITHUB_CLIENT_SECRET: 'test-client-secret',
        };
        return values[key] ?? '';
      }),
    };

    service = new AuthService(
      authRepo as unknown as AuthRepository,
      orgRepo as unknown as OrganizationsRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      {
        mask: vi.fn().mockImplementation(({ text }: { text: string }) => text),
      } as unknown as SecretMaskingService,
      createMockRedis() as never,
    );
  });

  describe('generateTokenPair', () => {
    it('should return access and refresh tokens', async () => {
      authRepo.createRefreshToken.mockResolvedValue({
        id: 'tok-uuid-42',
        userId: 1,
        tokenHash: 'hash',
      });

      const result = await service.generateTokenPair({
        userId: 1,
        username: 'octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toMatch(/^tok-uuid-42\./);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, username: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/1' },
        { expiresIn: '15m' },
      );
      expect(authRepo.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1 }),
      );
    });

    it('should store bcrypt hash of the refresh token secret', async () => {
      let storedHash = '';
      authRepo.createRefreshToken.mockImplementation((args: { tokenHash: string }) => {
        storedHash = args.tokenHash;
        return Promise.resolve({ id: 'tok-uuid-1', userId: 1, tokenHash: args.tokenHash });
      });

      const result = await service.generateTokenPair({ userId: 1, username: 'u', avatarUrl: null });
      const secret = result.refreshToken.split('.')[1];

      const matches = await bcrypt.compare(secret, storedHash);
      expect(matches).toBe(true);
    });
  });

  describe('refreshTokens', () => {
    it('should rotate tokens on valid refresh', async () => {
      const secret = 'test-secret';
      const hash = await bcrypt.hash(secret, 10);
      const mockRevoke = vi.fn().mockResolvedValue(undefined);
      const mockRevokeAll = vi.fn().mockResolvedValue(undefined);

      authRepo.withLockedRefreshToken.mockImplementation(
        async ({
          fn,
        }: {
          fn: (ctx: {
            token: Record<string, unknown>;
            revoke: () => Promise<void>;
            revokeAll: () => Promise<void>;
          }) => Promise<unknown>;
        }) =>
          fn({
            token: {
              id: 'tok-uuid-10',
              userId: 5,
              tokenHash: hash,
              expiresAt: new Date(Date.now() + 86400000),
              revokedAt: null,
            },
            revoke: mockRevoke,
            revokeAll: mockRevokeAll,
          }),
      );
      authRepo.findUserById.mockResolvedValue({ id: 5, username: 'user5', avatarUrl: null });
      authRepo.createRefreshToken.mockResolvedValue({
        id: 'tok-uuid-11',
        userId: 5,
        tokenHash: 'new-hash',
      });

      const result = await service.refreshTokens({ refreshToken: `tok-uuid-10.${secret}` });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toMatch(/^tok-uuid-11\./);
      expect(mockRevoke).toHaveBeenCalled();
      expect(mockRevokeAll).not.toHaveBeenCalled();
    });

    it('should throw on expired refresh token', async () => {
      authRepo.withLockedRefreshToken.mockImplementation(
        async ({
          fn,
        }: {
          fn: (ctx: {
            token: Record<string, unknown>;
            revoke: () => Promise<void>;
            revokeAll: () => Promise<void>;
          }) => Promise<unknown>;
        }) =>
          fn({
            token: {
              id: 'tok-uuid-10',
              userId: 5,
              tokenHash: 'hash',
              expiresAt: new Date(Date.now() - 1000),
              revokedAt: null,
            },
            revoke: vi.fn(),
            revokeAll: vi.fn(),
          }),
      );

      await expect(
        service.refreshTokens({ refreshToken: 'tok-uuid-10.some-secret' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke all tokens on reuse detection', async () => {
      const mockRevoke = vi.fn().mockResolvedValue(undefined);
      const mockRevokeAll = vi.fn().mockResolvedValue(undefined);

      authRepo.withLockedRefreshToken.mockImplementation(
        async ({
          fn,
        }: {
          fn: (ctx: {
            token: Record<string, unknown>;
            revoke: () => Promise<void>;
            revokeAll: () => Promise<void>;
          }) => Promise<unknown>;
        }) =>
          fn({
            token: {
              id: 'tok-uuid-10',
              userId: 5,
              tokenHash: 'hash',
              expiresAt: new Date(Date.now() + 86400000),
              revokedAt: new Date(), // Already revoked!
            },
            revoke: mockRevoke,
            revokeAll: mockRevokeAll,
          }),
      );

      await expect(
        service.refreshTokens({ refreshToken: 'tok-uuid-10.some-secret' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRevokeAll).toHaveBeenCalled();
      expect(mockRevoke).not.toHaveBeenCalled();
    });

    it('should throw on invalid secret', async () => {
      const hash = await bcrypt.hash('correct-secret', 10);

      authRepo.withLockedRefreshToken.mockImplementation(
        async ({
          fn,
        }: {
          fn: (ctx: {
            token: Record<string, unknown>;
            revoke: () => Promise<void>;
            revokeAll: () => Promise<void>;
          }) => Promise<unknown>;
        }) =>
          fn({
            token: {
              id: 'tok-uuid-10',
              userId: 5,
              tokenHash: hash,
              expiresAt: new Date(Date.now() + 86400000),
              revokedAt: null,
            },
            revoke: vi.fn(),
            revokeAll: vi.fn(),
          }),
      );

      await expect(
        service.refreshTokens({ refreshToken: 'tok-uuid-10.wrong-secret' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when token not found', async () => {
      authRepo.withLockedRefreshToken.mockResolvedValue(undefined);

      await expect(
        service.refreshTokens({ refreshToken: 'tok-uuid-999.some-secret' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on malformed refresh token', async () => {
      await expect(service.refreshTokens({ refreshToken: 'no-dot-here' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke a valid refresh token', async () => {
      const secret = 'logout-secret';
      const hash = await bcrypt.hash(secret, 10);

      authRepo.findRefreshToken.mockResolvedValue({
        id: 'tok-uuid-20',
        userId: 3,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      await service.logout({ refreshToken: `tok-uuid-20.${secret}` });

      expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith({ id: 'tok-uuid-20' });
    });

    it('should silently ignore already-revoked tokens', async () => {
      authRepo.findRefreshToken.mockResolvedValue({
        id: 'tok-uuid-20',
        userId: 3,
        tokenHash: 'hash',
        revokedAt: new Date(),
      });

      await expect(service.logout({ refreshToken: 'tok-uuid-20.secret' })).resolves.toBeUndefined();
      expect(authRepo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('should silently ignore unknown tokens', async () => {
      authRepo.findRefreshToken.mockResolvedValue(undefined);

      await expect(
        service.logout({ refreshToken: 'tok-uuid-999.secret' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleGitHubCallback', () => {
    function createFetchMock({
      memberships = [
        {
          role: 'admin' as 'admin' | 'member',
          state: 'active' as 'active' | 'pending',
          organization: { id: 1, login: 'my-org', avatar_url: '' },
        },
      ],
      user = { id: 12345, login: 'octocat', email: 'octo@example.com', avatar_url: '' },
    }: {
      memberships?: {
        role: 'admin' | 'member';
        state: 'active' | 'pending';
        organization: { id: number; login: string; avatar_url: string };
      }[];
      user?: { id: number; login: string; email: string; avatar_url: string };
    } = {}): typeof fetch {
      return vi.fn().mockImplementation((url: string) => {
        if (url.includes('login/oauth/access_token')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ access_token: 'gh-token', token_type: 'bearer', scope: '' }),
          });
        }
        if (url.includes('api.github.com/user/memberships/orgs')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(memberships),
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(user),
          });
        }
        return Promise.resolve({ ok: false });
      }) as unknown as typeof fetch;
    }

    beforeEach(() => {
      vi.stubGlobal('fetch', createFetchMock());

      authRepo.upsertUser.mockResolvedValue({
        id: 1,
        username: 'octocat',
        githubId: 12345,
        avatarUrl: '',
      });
      orgRepo.findOrgsByUserId.mockResolvedValue([]);
      orgRepo.findOrgBySlug.mockResolvedValue(undefined);
      orgRepo.createOrg.mockResolvedValue({ id: 10, name: 'my-org', slug: 'my-org' });
      orgRepo.addMember.mockResolvedValue({});
      orgRepo.getMemberRole.mockResolvedValue(null);
      orgRepo.updateMemberRole.mockResolvedValue(undefined);
      authRepo.createRefreshToken.mockResolvedValue({ id: 'tok-uuid-1' });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should exchange code, upsert user, sync orgs, and return tokens', async () => {
      orgRepo.createOrg
        .mockResolvedValueOnce({ id: 10, name: 'my-org', slug: 'my-org' })
        .mockResolvedValueOnce({ id: 20, name: 'octocat', slug: 'octocat' });

      const result = await service.handleGitHubCallback({ code: 'test-code' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(authRepo.upsertUser).toHaveBeenCalledWith({
        githubProfile: {
          githubId: 12345,
          username: 'octocat',
          email: 'octo@example.com',
          avatarUrl: '',
        },
      });
      expect(orgRepo.createOrg).toHaveBeenCalledWith({ name: 'my-org', slug: 'my-org' });
      expect(orgRepo.addMember).toHaveBeenCalledWith({ orgId: 10, userId: 1, role: 'owner' });
      // Also creates personal org
      expect(orgRepo.createOrg).toHaveBeenCalledWith({
        name: 'octocat',
        slug: 'octocat',
        avatarUrl: '',
      });
      expect(orgRepo.addMember).toHaveBeenCalledWith({ orgId: 20, userId: 1, role: 'owner' });
    });

    it('should sync role when user already belongs to the org', async () => {
      orgRepo.findOrgsByUserId.mockResolvedValue([{ id: 10, slug: 'my-org', name: 'my-org' }]);
      orgRepo.getMemberRole.mockResolvedValue('member');
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      // Should update member to admin (GitHub says admin)
      expect(orgRepo.updateMemberRole).toHaveBeenCalledWith({
        orgId: 10,
        userId: 1,
        role: 'admin',
      });
      // Should not re-create the org
      expect(orgRepo.createOrg).not.toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'my-org' }),
      );
    });

    it('should not downgrade owner role even when GitHub says member', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'member',
              state: 'active',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.findOrgsByUserId.mockResolvedValue([{ id: 10, slug: 'my-org', name: 'my-org' }]);
      orgRepo.getMemberRole.mockResolvedValue('owner');
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.updateMemberRole).not.toHaveBeenCalled();
    });

    it('should downgrade admin to member when GitHub says member', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'member',
              state: 'active',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.findOrgsByUserId.mockResolvedValue([{ id: 10, slug: 'my-org', name: 'my-org' }]);
      orgRepo.getMemberRole.mockResolvedValue('admin');
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.updateMemberRole).toHaveBeenCalledWith({
        orgId: 10,
        userId: 1,
        role: 'member',
      });
    });

    it('should upgrade member to admin when GitHub says admin', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'admin',
              state: 'active',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.findOrgsByUserId.mockResolvedValue([{ id: 10, slug: 'my-org', name: 'my-org' }]);
      orgRepo.getMemberRole.mockResolvedValue('member');
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.updateMemberRole).toHaveBeenCalledWith({
        orgId: 10,
        userId: 1,
        role: 'admin',
      });
    });

    it('should skip pending memberships', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'admin',
              state: 'pending',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      // Should not create or join the pending org
      expect(orgRepo.createOrg).not.toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'my-org' }),
      );
      expect(orgRepo.addMember).not.toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });

    it('should add user with mapped role to existing org created by another user', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'member',
              state: 'active',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.findOrgBySlug.mockResolvedValue({ id: 10, name: 'my-org', slug: 'my-org' });
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.addMember).toHaveBeenCalledWith({ orgId: 10, userId: 1, role: 'member' });
    });

    it('should add user as admin to existing org when GitHub says admin', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [
            {
              role: 'admin',
              state: 'active',
              organization: { id: 1, login: 'my-org', avatar_url: '' },
            },
          ],
        }),
      );

      orgRepo.findOrgBySlug.mockResolvedValue({ id: 10, name: 'my-org', slug: 'my-org' });
      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.addMember).toHaveBeenCalledWith({ orgId: 10, userId: 1, role: 'admin' });
    });

    it('should create a personal org from the GitHub username when user has no orgs', async () => {
      vi.stubGlobal(
        'fetch',
        createFetchMock({
          memberships: [],
          user: {
            id: 12345,
            login: 'octocat',
            email: 'octo@example.com',
            avatar_url: 'https://avatar.url',
          },
        }),
      );

      orgRepo.createOrg.mockResolvedValue({ id: 20, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.createOrg).toHaveBeenCalledWith({
        name: 'octocat',
        slug: 'octocat',
        avatarUrl: 'https://avatar.url',
      });
      expect(orgRepo.addMember).toHaveBeenCalledWith({ orgId: 20, userId: 1, role: 'owner' });
    });

    it('should not create a personal org if user already belongs to one with the same slug', async () => {
      orgRepo.findOrgsByUserId
        .mockResolvedValueOnce([]) // First call: for GitHub org sync
        .mockResolvedValueOnce([{ id: 5, slug: 'octocat', name: 'octocat' }]); // Second call: for personal org check

      await service.handleGitHubCallback({ code: 'test-code' });

      // Only the GitHub org should be created, not the personal org
      expect(orgRepo.createOrg).toHaveBeenCalledTimes(1);
      expect(orgRepo.createOrg).toHaveBeenCalledWith({ name: 'my-org', slug: 'my-org' });
    });

    it('should not create a personal org if another user already owns that slug', async () => {
      vi.stubGlobal('fetch', createFetchMock({ memberships: [] }));

      orgRepo.findOrgBySlug.mockResolvedValue({ id: 99, name: 'octocat', slug: 'octocat' });

      await service.handleGitHubCallback({ code: 'test-code' });

      expect(orgRepo.createOrg).not.toHaveBeenCalled();
    });

    it('should reject when GitHub returns error in token exchange', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('login/oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  error: 'bad_verification_code',
                  error_description: 'The code passed is incorrect or expired.',
                }),
            });
          }
          return Promise.resolve({ ok: false });
        }),
      );

      await expect(service.handleGitHubCallback({ code: 'expired-code' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
