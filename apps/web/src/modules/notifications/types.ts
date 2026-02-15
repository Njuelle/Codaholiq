export interface Notification {
  readonly id: number;
  readonly orgId: number;
  readonly executionId: number;
  readonly automationName: string;
  readonly message: string;
  readonly createdAt: string;
}
