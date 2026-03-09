import { z } from 'zod';

const MAX_RANGE_DAYS = 365;

export const analyticsQuerySchema = z
  .object({
    from: z
      .string()
      .datetime({ message: 'from must be a valid ISO date string' })
      .transform((v) => new Date(v)),
    to: z
      .string()
      .datetime({ message: 'to must be a valid ISO date string' })
      .transform((v) => new Date(v)),
    repoId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  })
  .refine((data) => data.from < data.to, {
    message: 'from must be before to',
  })
  .refine(
    (data) => {
      const diffMs = data.to.getTime() - data.from.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= MAX_RANGE_DAYS;
    },
    { message: `Date range must not exceed ${MAX_RANGE_DAYS} days` },
  );

export type AnalyticsQueryDto = z.output<typeof analyticsQuerySchema>;
