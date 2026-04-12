import axiosClient from "./axiosClient";
import { normalizeLoginResponse, type ApiUser } from "../utils/apiMappers";

export type LoginResponse = {
  accessToken: string;
  user: ApiUser | null;
};

function normalizeAccount(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function loginWithEmailOrUsername(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const account = normalizeAccount(identifier);
  const safePassword = String(password || "");

  if (!account || !safePassword) {
    throw new Error("Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
  }

  if (import.meta.env.DEV) {
    console.log("👀 loginWithEmailOrUsername called:", { identifier: account });
  }

  let response: unknown;
  try {
    response = await axiosClient.post("/auth/login", {
      identifier: account,
      username: account,
      email: account,
      password: safePassword,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("❌ loginWithEmailOrUsername failed:", error);
    }
    throw error;
  }

  if (import.meta.env.DEV) {
    console.log("👀 DỮ LIỆU THẬT MÀ AXIOS NHẬN ĐƯỢC LÀ:", response);
  }

  const normalized = normalizeLoginResponse(response);

  if (!normalized.accessToken) {
    throw new Error("Đăng nhập thất bại. Backend không trả về token.");
  }

  return normalized;
}
