type JwtPayload = {
  sub?: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
};

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) return null;
    return JSON.parse(fromBase64Url(payloadPart)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}
