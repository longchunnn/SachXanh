import axiosClient from "./axiosClient";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

type AnyRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => asString(item)).filter(Boolean);
}

export type ApiVoucherType = "discount" | "freeship";

export type ApiVoucher = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discount_percent: number;
  applies_to_categories: string[];
  voucher_type: ApiVoucherType;
  condition_text?: string;
  valid_from?: string;
  valid_to?: string;
  terms?: string;
};

export function normalizeVoucher(raw: unknown): ApiVoucher {
  const voucher = (raw ?? {}) as AnyRecord;

  return {
    id: asString(voucher.id),
    title: asString(voucher.title),
    subtitle: asString(voucher.subtitle),
    code: asString(voucher.code),
    discount_percent: asNumber(voucher.discount_percent ?? voucher.discountPercent),
    applies_to_categories: asStringArray(voucher.applies_to_categories ?? voucher.appliesToCategories) ?? ["ALL"],
    voucher_type: (asString(voucher.voucher_type ?? voucher.voucherType).toLowerCase() as ApiVoucherType) || "discount",
    condition_text:
      typeof voucher.condition_text === "string" ? voucher.condition_text : undefined,
    valid_from:
      typeof voucher.valid_from === "string" ? voucher.valid_from : undefined,
    valid_to: typeof voucher.valid_to === "string" ? voucher.valid_to : undefined,
    terms: typeof voucher.terms === "string" ? voucher.terms : undefined,
  };
}

// Admin endpoints (fallback to /promotions)
export async function getVouchers(): Promise<ApiVoucher[]> {
  const response = await axiosClient.get("/promotions", {
    params: { _page: 0, _limit: 200, _sort: "id", _order: "desc" },
  });
  return unwrapPagedContent<unknown>(response).map((entry) => normalizeVoucher(entry));
}

export async function createVoucher(payload: Record<string, unknown>): Promise<ApiVoucher> {
  const response = await axiosClient.post("/promotions", payload);
  return normalizeVoucher(unwrapResult(response));
}

export async function updateVoucherPartial(voucherId: string, payload: Record<string, unknown>): Promise<ApiVoucher> {
  const response = await axiosClient.patch(`/promotions/${encodeURIComponent(voucherId)}`, payload);
  return normalizeVoucher(unwrapResult(response));
}
