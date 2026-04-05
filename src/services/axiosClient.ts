import axios from "axios";
import { isJwtExpired } from "../utils/jwt";

const DEFAULT_BASE_URL = "http://localhost:8000";
const AUTH_TOKEN_KEY = "access_token";

const baseURL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  DEFAULT_BASE_URL;

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (!token) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // ignore storage errors (private mode, blocked storage, etc.)
  }
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export type NormalizedAxiosError = {
  message: string;
  status: number | null;
  data: unknown;
  isNetworkError: boolean;
  isCanceled: boolean;
  original: unknown;
};

export function normalizeAxiosError(error: unknown): NormalizedAxiosError {
  const safeError = error as {
    isAxiosError?: boolean;
    message?: string;
    response?: { status?: number; data?: unknown };
  };

  if (!safeError) {
    return {
      message: "Unknown error",
      status: null,
      data: null,
      isNetworkError: false,
      isCanceled: false,
      original: error,
    };
  }

  const isAxios = Boolean(safeError.isAxiosError);
  const status = safeError.response?.status ?? null;
  const data = safeError.response?.data ?? null;
  const isCanceled =
    typeof axios.isCancel === "function" ? axios.isCancel(safeError) : false;
  const isNetworkError = isAxios && !safeError.response;

  let message = safeError.message || "Request failed";
  if (typeof data === "string" && data.trim()) message = data;
  if (data && typeof data === "object") {
    const dataObj = data as { message?: string; error?: string };
    message = dataObj.message || dataObj.error || message;
  }

  return {
    message,
    status,
    data,
    isNetworkError,
    isCanceled,
    original: error,
  };
}

const axiosClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      if (isJwtExpired(token)) {
        clearAccessToken();
        return config;
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(normalizeAxiosError(error)),
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error: unknown) => {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 401) {
      clearAccessToken();
    }
    return Promise.reject(normalizeAxiosError(error));
  },
);

export default axiosClient;
