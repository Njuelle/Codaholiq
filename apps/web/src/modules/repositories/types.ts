export interface Repository {
  readonly id: number;
  readonly githubId: number;
  readonly installationId: number;
  readonly orgId: number;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly private: boolean;
  readonly language: string | null;
  readonly archived: boolean;
  readonly webhookActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModelPolicyEntry {
  readonly provider: string;
  readonly model: string;
  readonly createdAt: string;
  readonly createdBy: number;
}

export interface ModelPoliciesResponse {
  readonly policies: readonly ModelPolicyEntry[];
  readonly isRestricted: boolean;
}
