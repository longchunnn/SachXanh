import axiosClient from "./axiosClient";
import { normalizeUser, type ApiUser } from "../utils/apiMappers";

export async function getUserById(userId: string): Promise<ApiUser | null> {
  if (!userId.trim()) return null;
  const response = (await axiosClient.get(
    `/users/${encodeURIComponent(userId)}`,
  )) as unknown;

  if (!response) return null;
  return normalizeUser(response);
}
