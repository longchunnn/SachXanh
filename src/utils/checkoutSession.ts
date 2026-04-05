import { type CartItem } from "./cart";

export type CheckoutSession = {
  items: CartItem[];
  selectedDiscountId: string | null;
  selectedFreeShipId: string | null;
};

const CHECKOUT_SESSION_KEY = "bookstore_checkout_session";

export function saveCheckoutSession(session: CheckoutSession): void {
  try {
    localStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

export function getCheckoutSession(): CheckoutSession | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CheckoutSession;
    if (!parsed || !Array.isArray(parsed.items)) return null;

    return {
      items: parsed.items,
      selectedDiscountId: parsed.selectedDiscountId ?? null,
      selectedFreeShipId: parsed.selectedFreeShipId ?? null,
    };
  } catch {
    return null;
  }
}

export function clearCheckoutSession(): void {
  try {
    localStorage.removeItem(CHECKOUT_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}
