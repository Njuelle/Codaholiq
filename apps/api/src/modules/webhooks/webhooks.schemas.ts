import { z } from 'zod';

const accountSchema = z.object({
  login: z.string(),
  type: z.enum(['Organization', 'User']),
});

const installationRefSchema = z.object({
  id: z.number(),
  account: accountSchema,
});

const repoRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
});

export const installationPayloadSchema = z.object({
  installation: installationRefSchema,
  repositories: z.array(repoRefSchema).optional(),
});

export const repositoriesChangedPayloadSchema = z.object({
  installation: installationRefSchema,
  repositories_added: z.array(repoRefSchema).optional(),
  repositories_removed: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
      }),
    )
    .optional(),
});

export type InstallationPayload = z.infer<typeof installationPayloadSchema>;
export type RepositoriesChangedPayload = z.infer<typeof repositoriesChangedPayloadSchema>;
