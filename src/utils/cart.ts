export type CartItem = {
  id: string;
  title: string;
  author?: string;
  categoryName?: string;
  coverSrc?: string;
  unitPrice: number;
  quantity: number;
};

const CART_ITEMS_KEY = "bookstore_cart_items";
const CART_UPDATED_EVENT = "bookstore:cart:updated";

function emitCartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function getCartItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // ignore storage issues
  }
  emitCartUpdated();
}

export function addToCart(
  item: Omit<CartItem, "quantity">,
  quantity = 1,
): void {
  const qty = Math.max(1, quantity);
  const items = getCartItems();
  const existing = items.find((cartItem) => cartItem.id === item.id);

  const next = existing
    ? items.map((cartItem) =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + qty }
          : cartItem,
      )
    : [...items, { ...item, quantity: qty }];

  saveCartItems(next);
}

export function updateCartQuantity(id: string, quantity: number): void {
  const items = getCartItems();
  const next =
    quantity <= 0
      ? items.filter((item) => item.id !== id)
      : items.map((item) => (item.id === id ? { ...item, quantity } : item));
  saveCartItems(next);
}

export function removeFromCart(id: string): void {
  const items = getCartItems();
  saveCartItems(items.filter((item) => item.id !== id));
}

export function getCartCount(): number {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(): number {
  return getCartItems().reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
}

export function subscribeCartUpdates(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_ITEMS_KEY) {
      listener();
    }
  };

  const onCartUpdated = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
  };
}
