import type { MembershipRole } from "@prisma/client";

export const permissions = [
  "dashboard:view", "bookings:view", "bookings:manage", "customers:view",
  "customers:manage", "catalog:view", "catalog:manage", "settings:manage", "users:manage"
] as const;
export type Permission = typeof permissions[number];

const rolePermissions: Record<MembershipRole, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: permissions,
  MANAGER: permissions.filter((p) => p !== "users:manage"),
  RECEPTIONIST: ["dashboard:view", "bookings:view", "bookings:manage", "customers:view", "customers:manage", "catalog:view"],
  PROFESSIONAL: ["dashboard:view", "bookings:view", "customers:view", "catalog:view"]
};

export function can(role: MembershipRole, overrides: string[], permission: Permission) {
  return rolePermissions[role].includes(permission) || overrides.includes(permission);
}
