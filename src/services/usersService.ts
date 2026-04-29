import axiosClient from "./axiosClient";
import { normalizeUser, type ApiUser } from "../utils/apiMappers";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

export async function getUserById(userId: string): Promise<ApiUser | null> {
  if (!userId.trim()) return null;
  const response = await axiosClient.get(`/users/${encodeURIComponent(userId)}`);
  return normalizeUser(unwrapResult(response));
}

export async function getUsersForStaff(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiUser[]> {
  const response = await axiosClient.get("/users", {
    params: {
      _page: params?.page ?? 0,
      _limit: params?.limit ?? 100,
      _sort: "userId",
      _order: "desc",
    },
  });
  return unwrapPagedContent<unknown>(response).map((entry) => normalizeUser(entry));
}

export async function updateUser(
  userId: string,
  payload: Partial<Pick<ApiUser, "full_name" | "email" | "phone" | "address">>,
): Promise<ApiUser> {
  const response = await axiosClient.patch(
    `/users/${encodeURIComponent(userId)}`,
    payload,
  );
  return normalizeUser(unwrapResult(response));
}
