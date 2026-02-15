import { automations, automationVariables } from './automations.schema';

export type AutomationWithVariables = typeof automations.$inferSelect & {
  variables: (typeof automationVariables.$inferSelect)[];
};
