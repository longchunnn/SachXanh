import axiosClient, { normalizeAxiosError } from "./axiosClient";
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

export type FlashSaleCampaign = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
};

export type FlashSaleCampaignItem = {
  id: string;
  campaign_id: string;
  book_id: string;
  flash_price: number;
  flash_stock: number;
  purchase_limit: number;
};

type ListQueryParams = Record<string, string | number>;

const listQueryAttempts: Array<ListQueryParams | undefined> = [
  { _page: 0, _limit: 200, _sort: "id", _order: "desc" },
  { _page: 0, _limit: 200 },
  undefined,
];

async function getWithListFallback(path: string): Promise<unknown> {
  let lastError: unknown = new Error("Flash sale list request failed");

  for (const params of listQueryAttempts) {
    try {
      if (params) return await axiosClient.get(path, { params });
      return await axiosClient.get(path);
    } catch (error) {
      lastError = error;
      const status =
        error && typeof error === "object" && "status" in error
          ? ((error as { status?: unknown }).status as
              | number
              | null
              | undefined)
          : null;

      // Retry only for payload/contract mismatches that often vary by backend.
      if (status !== 400 && status !== 500) {
        throw error;
      }
    }
  }

  throw lastError;
}

function normalizeCampaign(raw: unknown): FlashSaleCampaign {
  const campaign = (raw ?? {}) as AnyRecord;

  return {
    id: asString(campaign.id),
    name: asString(campaign.name),
    starts_at: asString(campaign.starts_at ?? campaign.startsAt),
    ends_at: asString(campaign.ends_at ?? campaign.endsAt),
  };
}

function normalizeCampaignItem(raw: unknown): FlashSaleCampaignItem {
  const item = (raw ?? {}) as AnyRecord;

  return {
    id: asString(item.id),
    campaign_id: asString(item.campaign_id ?? item.campaignId),
    book_id: asString(item.book_id ?? item.bookId),
    flash_price: asNumber(item.flash_price ?? item.flashPrice),
    flash_stock: asNumber(item.flash_stock ?? item.flashStock),
    purchase_limit: Math.max(
      1,
      asNumber(item.purchase_limit ?? item.purchaseLimit, 1),
    ),
  };
}

// Suggested endpoints. Adjust on backend if different.
export async function getCampaigns(): Promise<FlashSaleCampaign[]> {
  const response = await getWithListFallback("/flash-sale/campaigns");
  return unwrapPagedContent<unknown>(response).map((entry) =>
    normalizeCampaign(entry),
  );
}

export async function createCampaign(
  payload: Record<string, unknown>,
): Promise<FlashSaleCampaign> {
  const response = await axiosClient.post("/flash-sale/campaigns", payload);
  return normalizeCampaign(unwrapResult(response));
}

export async function getCampaignItems(
  campaignId: string,
): Promise<FlashSaleCampaignItem[]> {
  const response = await getWithListFallback(
    `/flash-sale/campaigns/${encodeURIComponent(campaignId)}/items`,
  );
  return unwrapPagedContent<unknown>(response).map((entry) =>
    normalizeCampaignItem(entry),
  );
}

export async function addCampaignItem(
  campaignId: string,
  payload: Record<string, unknown>,
): Promise<FlashSaleCampaignItem> {
  const response = await axiosClient.post(
    `/flash-sale/campaigns/${encodeURIComponent(campaignId)}/items`,
    payload,
  );
  return normalizeCampaignItem(unwrapResult(response));
}

export async function deleteCampaign(campaignId: string | number): Promise<void> {
  const safeId = String(campaignId ?? "").trim();
  if (!safeId) throw new Error("Mã chiến dịch không hợp lệ.");

  try {
    // Đánh thẳng vào endpoint mà Spring Boot của chúng ta đang chờ
    await axiosClient.delete(`/flash-sale/campaigns/${encodeURIComponent(safeId)}`);
  } catch (error) {
    console.error(`Lỗi khi xóa chiến dịch ${safeId}:`, error);
    // Bạn có thể quăng cái normalizeAxiosError của bạn ở đây để Component bắt lấy
    throw normalizeAxiosError(error); 
  }

}
