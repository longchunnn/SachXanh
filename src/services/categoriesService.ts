import axiosClient from "./axiosClient";

export type ApiCategory = {
  id: string;
  name: string;
};

function normalizeCategory(raw: unknown): ApiCategory {
  const value = (raw ?? {}) as Record<string, unknown>;
  const id = value.id;
  const name = value.name ?? value.category_name ?? value.categoryName;

  return {
    id: typeof id === "string" || typeof id === "number" ? String(id) : "",
    name: typeof name === "string" ? name : "",
  };
}

export async function getCategories(): Promise<ApiCategory[]> {
  const response = (await axiosClient.get("/categories")) as unknown;
  if (!Array.isArray(response)) return [];
  return response.map((entry) => normalizeCategory(entry));
}

export async function getCategoryById(
  categoryId: string,
): Promise<ApiCategory | null> {
  if (!categoryId.trim()) return null;
  const response = (await axiosClient.get(
    `/categories/${encodeURIComponent(categoryId)}`,
  )) as unknown;

  if (!response) return null;
  return normalizeCategory(response);
}
