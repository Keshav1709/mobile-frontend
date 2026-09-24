/**
 * What this login may do, from the console manifest.
 *
 * Ported from the dashboard's `src/lib/console/access.ts` so the app and the web
 * console answer the same question the same way. Roles and the 21 permission keys are
 * the backend's (`app/services/rbac.py`); a tenant can also define custom roles, which
 * is exactly why the manifest's explicit `permissions` list is the authority and the
 * role matrix below is only a fallback for a manifest too old to carry one.
 *
 * The app never creates or edits roles — it only reads the effective set.
 */

export type ConsoleRole = 'owner' | 'admin' | 'member' | 'operator' | 'viewer';

const RANK: Record<string, number> = { viewer: 0, operator: 1, member: 1, admin: 2, owner: 3 };

export function roleRank(role: string | null | undefined): number {
  return RANK[(role ?? 'viewer').toLowerCase()] ?? 0;
}

export function roleAtLeast(role: string | null | undefined, required: ConsoleRole): boolean {
  return roleRank(role) >= roleRank(required);
}

/** Permission → minimum system role, mirroring app/services/rbac.py's ROLE_PERMISSIONS. */
const PERMISSION_ROLE: Record<string, ConsoleRole> = {
  'live.view': 'viewer',
  'alerts.view': 'viewer',
  'alerts.acknowledge': 'member',
  'alerts.rules': 'admin',
  'people.view': 'viewer',
  'people.manage': 'admin',
  'reports.view': 'viewer',
  'reports.manage': 'admin',
  'recordings.view': 'viewer',
  'mira.use': 'member',
  'cameras.manage': 'admin',
  'devices.manage': 'admin',
  'capabilities.manage': 'admin',
  'org.view': 'admin',
  'org.configure': 'admin',
  'sites.manage': 'admin',
  'members.invite': 'admin',
  'members.manage': 'admin',
  'members.role': 'admin',
  'roles.manage': 'admin',
  'billing.manage': 'owner',
};

export type PermissionHolder = {
  role?: string | null;
  permissions?: string[] | null;
  grants?: Record<string, boolean> | null;
} | null | undefined;

/**
 * The one check screens should use.
 *
 * A custom role ("Security desk") carries its own permission set that no role matrix
 * can predict, so an explicit list always wins. Without a list — an older manifest, or
 * none loaded yet — fall back to the system matrix, which is right for the four system
 * roles and conservative for everything else.
 */
export function hasPermission(user: PermissionHolder, permission: string): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions)) {
    return user.permissions.includes(permission) || Boolean(user.grants?.[permission]);
  }
  if (user.grants?.[permission]) return true;
  const required = PERMISSION_ROLE[permission];
  return required ? roleAtLeast(user.role, required) : false;
}
