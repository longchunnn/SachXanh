import { getAccessToken } from "../services/axiosClient";
import { isJwtExpired } from "./jwt";

export type VoucherType = "discount" | "freeship";

export type VoucherWalletItem = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  discount_percent: number;
  applies_to_categories: string[];
  voucher_type: VoucherType;
  claimed_at: string;
};

const CLAIMED_VOUCHERS_KEY = "claimed_vouchers";
const VOUCHER_UPDATED_EVENT = "bookstore:voucher:updated";

function emitVoucherUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOUCHER_UPDATED_EVENT));
}

function canUseVoucherWallet(): boolean {
  const token = getAccessToken();
  return Boolean(token && !isJwtExpired(token));
}

function normalizeVoucherDisplay(
  voucher: VoucherWalletItem,
): VoucherWalletItem {
  if (voucher.voucher_type !== "freeship") {
    return voucher;
  }

  return {
    ...voucher,
    title: "Giảm 100% phí vận chuyển",
    subtitle: "Áp dụng cho phí ship tiêu chuẩn",
  };
}

function normalizeCategories(categories?: string[]): string[] {
  if (!Array.isArray(categories) || categories.length === 0) {
    return ["ALL"];
  }
  return categories;
}

export function getClaimedVouchers(): VoucherWalletItem[] {
  if (!canUseVoucherWallet()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(CLAIMED_VOUCHERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VoucherWalletItem[];
    return Array.isArray(parsed)
      ? parsed.map((voucher) => normalizeVoucherDisplay(voucher))
      : [];
  } catch {
    return [];
  }
}

export function saveClaimedVouchers(vouchers: VoucherWalletItem[]): void {
  if (!canUseVoucherWallet()) {
    return;
  }

  try {
    localStorage.setItem(CLAIMED_VOUCHERS_KEY, JSON.stringify(vouchers));
  } catch {
    // Ignore storage errors.
  }

  emitVoucherUpdated();
}

export function claimVoucher(
  voucher: Omit<VoucherWalletItem, "claimed_at" | "applies_to_categories"> & {
    applies_to_categories?: string[];
  },
): boolean {
  if (!canUseVoucherWallet()) {
    return false;
  }

  const current = getClaimedVouchers();
  const exists = current.some((item) => item.id === voucher.id);
  if (exists) return false;

  const next: VoucherWalletItem = {
    ...voucher,
    applies_to_categories: normalizeCategories(voucher.applies_to_categories),
    claimed_at: new Date().toISOString(),
  };

  saveClaimedVouchers([normalizeVoucherDisplay(next), ...current]);
  return true;
}

export function isVoucherClaimed(voucherId: string): boolean {
  return getClaimedVouchers().some((item) => item.id === voucherId);
}

export function getClaimedVouchersByCategory(
  category: string,
): VoucherWalletItem[] {
  return getClaimedVouchers().filter(
    (voucher) =>
      voucher.applies_to_categories.includes("ALL") ||
      voucher.applies_to_categories.includes(category),
  );
}

export function subscribeVoucherUpdates(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === CLAIMED_VOUCHERS_KEY) {
      listener();
    }
  };

  const onVoucherUpdated = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(VOUCHER_UPDATED_EVENT, onVoucherUpdated);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VOUCHER_UPDATED_EVENT, onVoucherUpdated);
  };
}
