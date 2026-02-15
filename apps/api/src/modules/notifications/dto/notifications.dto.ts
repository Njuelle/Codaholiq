import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

export interface NotificationDto {
  readonly id: number;
  readonly orgId: number;
  readonly executionId: number;
  readonly automationName: string;
  readonly message: string;
  readonly createdAt: Date;
}
