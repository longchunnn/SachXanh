const ROLE_ID_TO_NAME: Record<string, string> = {
  "1": "ADMIN",
  "2": "STAFF",
  "3": "USER",
};

export function normalizeRole(value: unknown): string {
  const safe = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!safe) return "";

  const withoutPrefix = safe.startsWith("ROLE_") ? safe.slice(5) : safe;
  return ROLE_ID_TO_NAME[withoutPrefix] ?? withoutPrefix;
}

function normalizeRoleEntry(value: unknown): string {
  const normalized = normalizeRole(value);
  return normalized ? `ROLE_${normalized}` : "";
}

export function hasRole(roles: string[] | undefined, role: string): boolean {
  const target = normalizeRoleEntry(role);
  if (!target) return false;
  return Array.isArray(roles)
    ? roles.some((item) => normalizeRoleEntry(item) === target)
    : false;
}

export function isStaffRole(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return ["ADMIN", "STAFF", "MANAGER"].includes(normalized);
}
