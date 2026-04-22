export const PERMISSIONS = {
  // User Management
  'user:read': ['admin'],
  'user:create': ['admin'],
  'user:update': ['admin'],
  'user:delete': ['admin'],

  // Customer 360
  'customer:read': ['admin', 'marketer', 'agent'],
  'customer:update': ['admin', 'marketer'],
  'customer:delete': ['admin'],

  // Segments
  'segment:read': ['admin', 'marketer'],
  'segment:create': ['admin', 'marketer'],
  'segment:update': ['admin', 'marketer'],
  'segment:delete': ['admin'],

  // Knowledge / AI
  'knowledge:read': ['admin', 'marketer', 'agent'],
  'knowledge:create': ['admin', 'marketer'],
  'knowledge:delete': ['admin'],

  // Workflows / Automation
  'workflow:read': ['admin', 'marketer'],
  'workflow:create': ['admin', 'marketer'],
  'workflow:update': ['admin', 'marketer'],
  'workflow:delete': ['admin'],

  // Dashboard
  'dashboard:view': ['admin', 'marketer', 'agent'],

  // Audit Logs
  'audit:read': ['admin'],
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type Role = 'admin' | 'marketer' | 'agent';

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}
