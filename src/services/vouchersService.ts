import axiosClient from "./axiosClient";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

type AnyRecord = Record<string, unknown>;


function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function parseFlexibleNumberString(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  // Remove currency symbols/letters/spaces, keep digits and separators
  const cleaned = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") {
    return null;
  }

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  // If both separators exist, assume the last one is decimal separator.
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";

    const normalized = cleaned
      .replaceAll(thousandsSep, "")
      .replace(decimalSep, ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Only one separator type.
  if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = cleaned.split(sep);

    // Detect thousand-group formatting: 30.000 or 1.234.567
    if (
      parts.length > 1 &&
      parts.slice(1).every((p) => p.length === 3) &&
      parts[0].length >= 1 &&
      parts[0].length <= 3
    ) {
      const normalized = cleaned.replaceAll(sep, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    // Otherwise treat separator as decimal.
    const normalized = sep === "," ? cleaned.replace(",", ".") : cleaned;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsedFlexible = parseFlexibleNumberString(value);
    if (parsedFlexible !== null) return parsedFlexible;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.map((item) => asString(item).trim()).filter(Boolean);
  return normalized.length ? normalized : undefined;
}

export type ApiVoucherType = "discount" | "freeship";

export type ApiVoucher = {
  promotionId: string;
  code: string;
  title?: string;
  description?: string;     // Đã thêm mô tả
  
  discountPercent: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  usedCount: number;        // Bỏ dấu ? vì hàm normalize đã default là 0
  
  startDate?: string;
  endDate?: string;
  status: number;           // Bỏ dấu ? vì hàm normalize đã default là 0
  
  applicableCategories: string[]; // Đổi tên cho khớp BE và bỏ dấu ? vì đã default là []
  
  createdAt?: string;
  updatedAt?: string;
};
export function normalizeVoucher(raw: unknown): ApiVoucher {
  const voucher = (raw ?? {}) as AnyRecord;

  return {
    promotionId: asString(voucher.id), // Đã map từ id của BE
    code: asString(voucher.code),
    title: asString(voucher.title) || undefined,
    description: asString(voucher.description) || undefined,
    
    // Chỉ bắt đúng 1 key do BE gửi về
    discountPercent: asNumber(voucher.discount_percent, 0),
    maxDiscountAmount: asNumber(voucher.max_discount_amount) || undefined,
    minOrderValue: asNumber(voucher.min_order_value) || undefined,
    usageLimit: asNumber(voucher.usage_limit) || undefined,
    usedCount: asNumber(voucher.used_count) || 0,
    
    // Ngày tháng và trạng thái
    startDate: asString(voucher.start_date) || undefined,
    endDate: asString(voucher.end_date) || undefined,
    status: asNumber(voucher.status, 0),
    
    // Danh sách thể loại
    applicableCategories: asStringArray(voucher.applicable_categories) ?? [],
    
    // Thời gian hệ thống
    createdAt: asString(voucher.created_at) || undefined,
    updatedAt: asString(voucher.updated_at) || undefined,
  };
}

// Admin endpoints (fallback to /promotions)
export async function getVouchers(): Promise<ApiVoucher[]> {
  const response = await axiosClient.get("/promotions", {
    params: { _page: 0, _limit: 200, _sort: "promotionId", _order: "desc" },
  });
  return unwrapPagedContent<unknown>(response).map((entry) =>
    normalizeVoucher(entry),
  );
}

export async function createVoucher(
  payload: Record<string, unknown>,
): Promise<ApiVoucher> {
  const response = await axiosClient.post("/promotions", payload);
  return normalizeVoucher(unwrapResult(response));
}

export async function updateVoucherPartial(
  voucherId: string,
  payload: Record<string, unknown>,
): Promise<ApiVoucher> {
  const response = await axiosClient.patch(
    `/promotions/${encodeURIComponent(voucherId)}`,
    payload,
  );
  return normalizeVoucher(unwrapResult(response));
}

export async function getVoucherById(
  voucherId: string,
): Promise<ApiVoucher | null> {
  const safeId = String(voucherId ?? "").trim();
  if (!safeId) return null;
  const response = await axiosClient.get(
    `/promotions/${encodeURIComponent(safeId)}`,
  );
  return normalizeVoucher(unwrapResult(response));
}
