import {
  Injectable,
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import type Redis from 'ioredis';
import { AuthRepository } from './auth.repository';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { SecretMaskingService } from '../../common/crypto/secret-masking.service';
import { REDIS } from '../redis/redis.constants';
import { TOKEN_BLACKLIST_PREFIX } from '../../common/guards/jwt-auth.guard';
import type { AuthTokens } from './dto/auth.dto';

interface GitHubTokenResponse {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
  readonly token_type?: string;
  readonly scope?: string;
}

interface GitHubUser {
  readonly id: number;
  readonly login: string;
  readonly email: string | null;
  readonly avatar_url: string;
}

interface GitHubOrgMembership {
  readonly role: 'admin' | 'member';
  readonly state: 'active' | 'pending';
  readonly organization: {
    readonly id: number;
    readonly login: string;
    readonly avatar_url: string;
  };
}

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;
const AUTH_CODE_TTL_SECONDS = 60;
const AUTH_CODE_PREFIX = 'auth:code:';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(OrganizationsRepository) private readonly orgRepository: OrganizationsRepository,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SecretMaskingService) private readonly secretMasking: SecretMaskingService,
    @Inject(REDIS) redis: Redis,
  ) {
    this.redis = redis;
  }

  private maskError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return this.secretMasking.mask({ text: message });
  }

  async createAuthCode({ tokens }: { tokens: AuthTokens }): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.redis.set(
      `${AUTH_CODE_PREFIX}${code}`,
      JSON.stringify(tokens),
      'EX',
      AUTH_CODE_TTL_SECONDS,
    );
    return code;
  }

  async exchangeAuthCode({ code }: { code: string }): Promise<AuthTokens> {
    const key = `${AUTH_CODE_PREFIX}${code}`;

    // Atomic get-and-delete to prevent TOCTOU race (two concurrent requests redeeming the same code)
    const stored = await this.redis.getdel(key);

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    return JSON.parse(stored) as AuthTokens;
  }

  async exchangeCodeForToken({ code }: { code: string }): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
        client_secret: this.configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
        code,
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to exchange code for GitHub token');
    }

    const data = (await response.json()) as GitHubTokenResponse;
    if (data.error || !data.access_token) {
      throw new UnauthorizedException(
        data.error_description || 'Invalid GitHub authorization code',
      );
    }

    return data.access_token;
  }

  async fetchGitHubUser({ accessToken }: { accessToken: string }): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to fetch GitHub user profile');
    }

    return response.json() as Promise<GitHubUser>;
  }

  async fetchGitHubMemberships({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<GitHubOrgMembership[]> {
    const response = await fetch('https://api.github.com/user/memberships/orgs', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to fetch GitHub organization memberships');
    }

    return response.json() as Promise<GitHubOrgMembership[]>;
  }

  async generateTokenPair({
    userId,
    username,
    avatarUrl,
  }: {
    userId: number;
    username: string;
    avatarUrl: string | null;
  }): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, username, avatarUrl },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const rawSecret = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawSecret, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    const tokenRecord = await this.authRepository.createRefreshToken({
      userId,
      tokenHash,
      expiresAt,
    });

    // Format: {uuid}.{rawSecret}
    const refreshToken = `${tokenRecord.id}.${rawSecret}`;

    return { accessToken, refreshToken };
  }

  async refreshTokens({ refreshToken }: { refreshToken: string }): Promise<AuthTokens> {
    const { id, secret } = this.parseRefreshToken(refreshToken);

    // All validation and revocation runs inside the same transaction that
    // holds the FOR UPDATE lock, preventing race conditions.
    const result = await this.authRepository.withLockedRefreshToken({
      id,
      fn: async ({ token, revoke, revokeAll }) => {
        // Reuse detection: if token is already revoked, revoke ALL tokens for this user
        if (token.revokedAt) {
          await revokeAll();
          throw new UnauthorizedException('Refresh token reuse detected');
        }

        if (token.expiresAt < new Date()) {
          throw new UnauthorizedException('Refresh token expired');
        }

        const isValid = await bcrypt.compare(secret, token.tokenHash);
        if (!isValid) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        // Revoke the old token atomically within the locked transaction
        await revoke();

        return { userId: token.userId };
      },
    });

    if (!result) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Fetch user to get current username (outside transaction — no lock needed)
    const user = await this.authRepository.findUserById({ id: result.userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokenPair({
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
  }

  async logout({
    refreshToken,
    accessToken,
  }: {
    refreshToken: string;
    accessToken?: string;
  }): Promise<void> {
    const { id, secret } = this.parseRefreshToken(refreshToken);

    const tokenRecord = await this.authRepository.findRefreshToken({ id });
    if (!tokenRecord || tokenRecord.revokedAt) return;

    const isValid = await bcrypt.compare(secret, tokenRecord.tokenHash);
    if (!isValid) return;

    await this.authRepository.revokeRefreshToken({ id: tokenRecord.id });

    // Blacklist the access token in Redis for its remaining lifetime (15min max)
    if (accessToken) {
      const tokenHash = createHash('sha256').update(accessToken).digest('hex');
      const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
      await this.redis.set(
        `${TOKEN_BLACKLIST_PREFIX}${tokenHash}`,
        '1',
        'EX',
        ACCESS_TOKEN_TTL_SECONDS,
      );
    }
  }

  async handleGitHubCallback({ code }: { code: string }): Promise<AuthTokens> {
    const accessToken = await this.exchangeCodeForToken({ code });
    const [githubUser, githubMemberships] = await Promise.all([
      this.fetchGitHubUser({ accessToken }),
      this.fetchGitHubMemberships({ accessToken }),
    ]);

    const user = await this.authRepository.upsertUser({
      githubProfile: {
        githubId: githubUser.id,
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
      },
    });

    // Sync GitHub org memberships with role mapping
    const userOrgs = await this.orgRepository.findOrgsByUserId({ userId: user.id });
    const activeMemberships = githubMemberships.filter((m) => m.state === 'active');

    for (const membership of activeMemberships) {
      const slug = membership.organization.login.toLowerCase();
      const mappedRole = membership.role === 'admin' ? 'admin' : 'member';

      const existingUserOrg = userOrgs.find((o) => o.slug === slug);

      if (existingUserOrg) {
        // User already belongs — sync role (never downgrade owner)
        await this.syncMemberRole({
          orgId: existingUserOrg.id,
          userId: user.id,
          mappedRole,
        });
        continue;
      }

      // Check if org exists globally (another user may have created it)
      const existingOrg = await this.orgRepository.findOrgBySlug({ slug });

      if (existingOrg) {
        try {
          await this.orgRepository.addMember({
            orgId: existingOrg.id,
            userId: user.id,
            role: mappedRole,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to add user ${user.id} to existing org ${slug}: ${this.maskError(error)}`,
          );
        }
      } else {
        try {
          const newOrg = await this.orgRepository.createOrg({
            name: membership.organization.login,
            slug,
          });
          await this.orgRepository.addMember({
            orgId: newOrg.id,
            userId: user.id,
            role: 'owner',
          });
        } catch (error) {
          // Org may have been created concurrently — try to join
          this.logger.warn(
            `Failed to create org ${slug}, attempting to join existing: ${this.maskError(error)}`,
          );
          try {
            const concurrentOrg = await this.orgRepository.findOrgBySlug({ slug });
            if (concurrentOrg) {
              await this.orgRepository.addMember({
                orgId: concurrentOrg.id,
                userId: user.id,
                role: mappedRole,
              });
            }
          } catch (joinError) {
            this.logger.warn(`Failed to join concurrent org ${slug}: ${this.maskError(joinError)}`);
          }
        }
      }
    }

    // Ensure user always has a personal org (based on GitHub username)
    await this.ensurePersonalOrg({
      user: { id: user.id, username: user.username, avatarUrl: githubUser.avatar_url },
    });

    return this.generateTokenPair({
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
  }

  private async syncMemberRole({
    orgId,
    userId,
    mappedRole,
  }: {
    orgId: number;
    userId: number;
    mappedRole: 'admin' | 'member';
  }): Promise<void> {
    const currentRole = await this.orgRepository.getMemberRole({ orgId, userId });
    if (!currentRole) return;

    // Never downgrade from owner (Codaholiq-specific role)
    if (currentRole === 'owner') return;

    // Update if role has changed
    if (currentRole !== mappedRole) {
      try {
        await this.orgRepository.updateMemberRole({ orgId, userId, role: mappedRole });
      } catch (error) {
        this.logger.warn(
          `Failed to sync role for user ${userId} in org ${orgId}: ${this.maskError(error)}`,
        );
      }
    }
  }

  private async ensurePersonalOrg({
    user,
  }: {
    user: { id: number; username: string; avatarUrl: string };
  }): Promise<void> {
    const slug = user.username.toLowerCase();
    const currentOrgs = await this.orgRepository.findOrgsByUserId({ userId: user.id });

    if (currentOrgs.some((o) => o.slug === slug)) return;

    const existingOrg = await this.orgRepository.findOrgBySlug({ slug });
    if (existingOrg) {
      try {
        await this.orgRepository.addMember({
          orgId: existingOrg.id,
          userId: user.id,
          role: 'owner',
        });
      } catch (error) {
        this.logger.warn(
          `Failed to add user ${user.id} to existing personal org ${slug}: ${this.maskError(error)}`,
        );
      }
      return;
    }

    try {
      const personalOrg = await this.orgRepository.createOrg({
        name: user.username,
        slug,
        avatarUrl: user.avatarUrl,
      });
      await this.orgRepository.addMember({ orgId: personalOrg.id, userId: user.id, role: 'owner' });
    } catch (error) {
      this.logger.warn(
        `Failed to create personal org for ${user.username}: ${this.maskError(error)}`,
      );
    }
  }

  private parseRefreshToken(refreshToken: string): { id: string; secret: string } {
    const dotIndex = refreshToken.indexOf('.');
    if (dotIndex === -1) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    const id = refreshToken.substring(0, dotIndex);
    const secret = refreshToken.substring(dotIndex + 1);

    if (!id || !secret) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    return { id, secret };
  }
}
