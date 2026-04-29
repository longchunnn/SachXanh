import axiosClient from "./axiosClient";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

export type ApiCategory = {
  id: string;
  name: string;
  parent_id?: number | null;
};

export type CategoryPayload = {
  name: string;
  parent_id?: number | null;
};

function normalizeCategory(raw: unknown): ApiCategory {
  const safe = (raw ?? {}) as Record<string, unknown>;
  const id = safe.id ?? safe.category_id ?? safe.categoryId;
  const name = safe.name ?? safe.category_name ?? safe.categoryName;
  const parentId = safe.parent_id ?? safe.parentId;

  return {
    id: typeof id === "number" || typeof id === "string" ? String(id) : "",
    name: typeof name === "string" ? name : "",
    parent_id:
      typeof parentId === "number"
        ? parentId
        : typeof parentId === "string" && parentId.trim()
          ? Number(parentId)
          : null,
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

export async function createCategory(payload: CategoryPayload): Promise<ApiCategory> {
  const response = await axiosClient.post("/categories", payload);
  return normalizeCategory(unwrapResult(response));
}

export async function updateCategory(
  categoryId: string,
  payload: CategoryPayload,
): Promise<ApiCategory> {
  const response = await axiosClient.patch(
    `/categories/${encodeURIComponent(categoryId)}`,
    payload,
  );
  return normalizeCategory(unwrapResult(response));
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await axiosClient.delete(`/categories/${encodeURIComponent(categoryId)}`);
}
