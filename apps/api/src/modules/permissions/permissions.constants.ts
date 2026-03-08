// Keep in sync with apps/web/src/types/permission.ts
export enum Permission {
  AUTOMATIONS_VIEW = 'automations.view',
  AUTOMATIONS_CREATE = 'automations.create',
  AUTOMATIONS_EDIT = 'automations.edit',
  AUTOMATIONS_DELETE = 'automations.delete',
  AUTOMATIONS_TOGGLE = 'automations.toggle',
  EXECUTIONS_VIEW = 'executions.view',
  EXECUTIONS_RETRY = 'executions.retry',
  ORG_SETTINGS_VIEW = 'org.settings.view',
  ORG_SETTINGS_EDIT = 'org.settings.edit',
  ORG_MEMBERS_VIEW = 'org.members.view',
  ORG_MEMBERS_MANAGE = 'org.members.manage',
  NOTIFICATIONS_VIEW = 'notifications.view',
  NOTIFICATIONS_DISMISS = 'notifications.dismiss',
  MODEL_POLICIES_MANAGE = 'model-policies.manage',
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const DEFAULT_ROLE_PERMISSIONS: Readonly<
  Record<'owner' | 'admin' | 'member', readonly Permission[]>
> = {
  owner: ALL_PERMISSIONS,
  admin: [
    Permission.AUTOMATIONS_VIEW,
    Permission.AUTOMATIONS_CREATE,
    Permission.AUTOMATIONS_EDIT,
    Permission.AUTOMATIONS_DELETE,
    Permission.AUTOMATIONS_TOGGLE,
    Permission.EXECUTIONS_VIEW,
    Permission.EXECUTIONS_RETRY,
    Permission.ORG_SETTINGS_VIEW,
    Permission.ORG_SETTINGS_EDIT,
    Permission.ORG_MEMBERS_VIEW,
    Permission.NOTIFICATIONS_VIEW,
    Permission.NOTIFICATIONS_DISMISS,
    Permission.MODEL_POLICIES_MANAGE,
  ],
  member: [
    Permission.AUTOMATIONS_VIEW,
    Permission.EXECUTIONS_VIEW,
    Permission.ORG_SETTINGS_VIEW,
    Permission.ORG_MEMBERS_VIEW,
    Permission.NOTIFICATIONS_VIEW,
  ],
};
