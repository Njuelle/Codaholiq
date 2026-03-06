export interface SharedVariable {
  readonly id: number;
  readonly orgId: number;
  readonly repoId: number | null;
  readonly key: string;
  readonly value: string;
  readonly isSecret: boolean;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSharedVariableInput {
  readonly key: string;
  readonly value: string;
  readonly isSecret?: boolean;
  readonly description?: string;
  readonly repoId?: number;
}

export interface UpdateSharedVariableInput {
  readonly value?: string;
  readonly description?: string | null;
}
