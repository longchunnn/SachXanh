type JwtPayload = {
  sub?: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
};

function toBase64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function createMockJwt(
  payload: { sub: string; [key: string]: unknown },
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + Math.max(1, expiresInSeconds),
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(body));
  const signature = toBase64Url("bookstore-frontend-mock-signature");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
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
