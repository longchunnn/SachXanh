export function normalizeRole(value: unknown): string {
  const safe = String(value || "").trim().toUpperCase();
  if (!safe) return "";
  return safe.startsWith("ROLE_") ? safe.slice(5) : safe;
}

export function hasRole(roles: string[] | undefined, role: string): boolean {
  const target = `ROLE_${normalizeRole(role)}`;
  return Array.isArray(roles)
    ? roles.map((item) => String(item || "").trim().toUpperCase()).includes(target)
    : false;
}

export function isStaffRole(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return ["ADMIN", "STAFF", "MANAGER"].includes(normalized);
}
