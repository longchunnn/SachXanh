import axiosClient from "./axiosClient";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

export type ApiCategory = {
  id: string;
  name: string;
};

function normalizeCategory(raw: unknown): ApiCategory {
  const safe = (raw ?? {}) as Record<string, unknown>;
  const id = safe.id;
  const name = safe.name;

  return {
    id: typeof id === "number" || typeof id === "string" ? String(id) : "",
    name: typeof name === "string" ? name : "",
  };
}

export async function getCategories(): Promise<ApiCategory[]> {
  const response = await axiosClient.get("/categories", {
    params: { _page: 0, _limit: 100 },
  });
  return unwrapPagedContent<unknown>(response).map((entry) => normalizeCategory(entry));
}

export async function getCategoryById(
  categoryId: string,
): Promise<ApiCategory | null> {
  if (!categoryId.trim()) return null;
  const response = await axiosClient.get(
    `/categories/${encodeURIComponent(categoryId)}`,
  );
  return normalizeCategory(unwrapResult(response));
}
