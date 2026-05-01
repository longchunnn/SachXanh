import axiosClient from "./axiosClient";
import { unwrapPagedContent } from "../utils/apiResponse";

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
  id: string; // Trong React cứ dùng id cho dễ
  name: string;
  starts_at: string;
  ends_at: string;
};

export type FlashSaleItem = {
  id: string; // Tương đương flashSaleItemId ở DB
  campaign_id: string;
  book_id: string;
  flash_price: number;
  flash_stock: number;
  purchase_limit: number;
};

function normalizeCampaign(raw: unknown): FlashSaleCampaign {
  const campaign = (raw ?? {}) as AnyRecord;
  return {
    id: asString(campaign.campaignId ?? campaign.id), // Hứng campaignId từ BE
    name: asString(campaign.name),
    starts_at: asString(
      campaign.startTime ?? campaign.startsAt ?? campaign.starts_at,
    ), // Khớp với startTime của Spring Boot
    ends_at: asString(campaign.endTime ?? campaign.endsAt ?? campaign.ends_at),
  };
}

function normalizeItem(raw: unknown): FlashSaleItem {
  const item = (raw ?? {}) as AnyRecord;
  return {
    id: asString(item.flashSaleItemId ?? item.id), // Hứng flashSaleItemId từ BE
    campaign_id: asString(item.campaignId ?? item.campaign_id),
    book_id: asString(item.bookId ?? item.book_id),
    flash_price: asNumber(
      item.flashSalePrice ?? item.flashPrice ?? item.flash_price,
    ), // Khớp với flashSalePrice
    flash_stock: asNumber(item.quantity ?? item.flashStock ?? item.flash_stock), // Khớp với quantity ở bảng DB
    purchase_limit: Math.max(
      1,
      asNumber(item.maxPerUser ?? item.purchaseLimit ?? item.purchase_limit, 1),
    ),
  };
}

// --------------------------------------------------------------------
// CÁC HÀM GỌI API ĐÃ ĐƯỢC LÀM SẠCH VÀ TRÚNG ĐÍCH
// --------------------------------------------------------------------

// 1. Get active campaigns
export async function getActiveCampaigns(): Promise<FlashSaleCampaign[]> {
  // Sửa thẳng tay: _sort=campaignId (Khớp với Spring Boot)
  const response = await axiosClient.get("/flash-sale/campaigns", {
    params: { _page: 0, _limit: 200, _sort: "campaignId", _order: "desc" },
  });

  const campaigns =
    unwrapPagedContent<unknown>(response).map(normalizeCampaign);

  const now = Date.now();
  return campaigns.filter((campaign) => {
    const start = new Date(campaign.starts_at).getTime();
    const end = new Date(campaign.ends_at).getTime();
    return (
      !Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end
    );
  });
}

// 2. Get items for a specific campaign
export async function getCampaignItems(
  campaignId: string,
): Promise<FlashSaleItem[]> {
  // Sửa thẳng tay: _sort=flashSaleItemId (Khớp với Spring Boot)
  const response = await axiosClient.get(
    `/flash-sale/campaigns/${encodeURIComponent(campaignId)}/items`,
    {
      params: {
        _page: 0,
        _limit: 200,
        _sort: "flashSaleItemId",
        _order: "desc",
      },
    },
  );

  return unwrapPagedContent<unknown>(response).map(normalizeItem);
}
