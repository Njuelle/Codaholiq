import {
  Injectable,
  Inject,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { Permission, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from './permissions.constants';

interface CacheEntry {
  readonly permissions: readonly Permission[];
  readonly expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_SIZE = 10_000;
const CACHE_CLEANUP_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class PermissionsService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PermissionsRepository)
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      this.evictExpiredEntries();
    }, CACHE_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async resolvePermissions({
    orgId,
    role,
  }: {
    orgId: number;
    role: 'owner' | 'admin' | 'member';
  }): Promise<readonly Permission[]> {
    if (role === 'owner') return ALL_PERMISSIONS;

    const cacheKey = `${orgId}:${role}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const override = await this.permissionsRepository.findByOrgAndRole({
      orgId,
      role,
    });

    const permissions: readonly Permission[] = override
      ? this.validatePermissionStrings(override.permissions)
      : DEFAULT_ROLE_PERMISSIONS[role];

    if (this.cache.size >= CACHE_MAX_SIZE) {
      this.evictExpiredEntries();
    }

    this.cache.set(cacheKey, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return permissions;
  }

  async getMyPermissions({
    orgId,
    role,
  }: {
    orgId: number;
    role: 'owner' | 'admin' | 'member';
  }): Promise<{ role: string; permissions: readonly Permission[] }> {
    const permissions = await this.resolvePermissions({ orgId, role });
    return { role, permissions };
  }

  async getAllRolePermissions({
    orgId,
  }: {
    orgId: number;
  }): Promise<Record<'owner' | 'admin' | 'member', readonly Permission[]>> {
    const [adminPerms, memberPerms] = await Promise.all([
      this.resolvePermissions({ orgId, role: 'admin' }),
      this.resolvePermissions({ orgId, role: 'member' }),
    ]);

    return {
      owner: ALL_PERMISSIONS,
      admin: adminPerms,
      member: memberPerms,
    };
  }

  async updateRolePermissions({
    orgId,
    role,
    permissions,
    requestingRole,
  }: {
    orgId: number;
    role: string;
    permissions: readonly string[];
    requestingRole: 'owner' | 'admin' | 'member';
  }): Promise<void> {
    if (requestingRole !== 'owner') {
      throw new ForbiddenException('Only owners can modify role permissions');
    }

    if (role === 'owner') {
      throw new BadRequestException(
        'Owner permissions cannot be modified — owners always have all permissions',
      );
    }

    if (role !== 'admin' && role !== 'member') {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const validated = this.validatePermissionStrings(permissions);

    await this.permissionsRepository.upsertForOrgAndRole({
      orgId,
      role,
      permissions: validated,
    });

    this.invalidateCacheForOrg({ orgId });
  }

  async resetOrgPermissions({
    orgId,
    requestingRole,
  }: {
    orgId: number;
    requestingRole: 'owner' | 'admin' | 'member';
  }): Promise<void> {
    if (requestingRole !== 'owner') {
      throw new ForbiddenException('Only owners can reset permissions');
    }

    await this.permissionsRepository.deleteByOrg({ orgId });
    this.invalidateCacheForOrg({ orgId });
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private invalidateCacheForOrg({ orgId }: { orgId: number }): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${orgId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private validatePermissionStrings(values: readonly string[]): readonly Permission[] {
    const validValues = new Set<string>(Object.values(Permission));
    const result: Permission[] = [];

    for (const v of values) {
      if (!validValues.has(v)) {
        throw new BadRequestException(`Invalid permission: ${v}`);
      }
      result.push(v as Permission);
    }

    return result;
  }
}
