import axiosClient from "./axiosClient";

export type UserRecord = {
  id: string;
  username: string;
  password: string;
  role_id: number;
  full_name: string;
  email: string;
  phone?: string;
  total_points: number;
  status: number;
};

function normalizeAccount(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function loginWithEmailOrUsername(
  identifier: string,
  password: string,
): Promise<UserRecord> {
  const account = normalizeAccount(identifier);
  const safePassword = String(password || "");

  if (!account || !safePassword) {
    throw new Error("Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
  }

  const query = account.includes("@")
    ? { email: account, password: safePassword }
    : { username: account, password: safePassword };

  const users = (await axiosClient.get("/users", {
    params: query,
  })) as UserRecord[];

  const user = Array.isArray(users)
    ? users.find((item) => String(item.status ?? 1) === "1")
    : null;

  if (!user) {
    throw new Error("Tài khoản hoặc mật khẩu không đúng.");
  }

  return user;
}
