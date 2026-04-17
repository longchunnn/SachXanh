export type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  result?: T;
};

export type PagedResult<T> = {
  content: T[];
  page: number;
  limit: number;
  totalElements: number;
  totalPages: number;
};

export function unwrapResult<T>(response: unknown): T {
  const payload = (response || {}) as ApiEnvelope<T> & T;
  if (Object.prototype.hasOwnProperty.call(payload, "result")) {
    return payload.result as T;
  }
  return response as T;
}

export function unwrapPagedContent<T>(response: unknown): T[] {
  const result = unwrapResult<PagedResult<T> | T[]>(response);
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.content) ? result.content : [];
}
