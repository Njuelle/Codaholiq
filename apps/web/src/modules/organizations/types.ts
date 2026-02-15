import type { Role } from '@/modules/auth/types';

export interface Organization {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OrgMember {
  readonly userId: number;
  readonly role: Role;
  readonly joinedAt: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface OrgDetail {
  readonly org: Organization;
  readonly memberCount: number;
}
