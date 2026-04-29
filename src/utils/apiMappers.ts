type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function findStringByKeys(
  raw: unknown,
  keys: string[],
  maxDepth = 4,
  visited = new WeakSet<object>(),
): string {
  const record = asRecord(raw);
  if (!record || maxDepth < 0) return "";

  if (visited.has(record)) return "";
  visited.add(record);

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  for (const value of Object.values(record)) {
    const nested = asRecord(value);
    if (!nested) continue;

    const found = findStringByKeys(nested, keys, maxDepth - 1, visited);
    if (found) return found;
  }

  return "";
}

export function extractPaymentUrl(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();

  return findStringByKeys(raw, [
    "payment_url",
    "paymentUrl",
    "paymentURL",
    "payment_link",
    "paymentLink",
    "vnpay_url",
    "vnpayUrl",
    "vnPayUrl",
    "vnpayPaymentUrl",
    "vnPayPaymentUrl",
    "vnpay_payment_url",
    "redirect_url",
    "redirectUrl",
    "checkout_url",
    "checkoutUrl",
    "payUrl",
    "pay_url",
    "url",
    "link",
  ]);
}

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

export type ApiBook = {
  id: string;
  title: string;
  author_name: string;
  original_price: number;
  selling_price: number;
  category_name: string;
  cover_image: string;
  sold_count: number;
  rental_count: number;
  total_stock?: number;
  description?: string;
  long_description?: string;
  gallery_images?: string[];
  publisher_id?: number | null;
  publication_year?: number | null;
  language?: string;
  status?: number;
};

export type ApiUser = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  address?: string;
  role_id?: number;
  status?: number;
  total_points?: number;
};

export type ApiOrderItem = {
  book_item_id: string;
  title: string;
  unit_price: number;
  quantity: number;
};

export type ApiOrder = {
  id: string;
  user_id: string;
  order_date: string;
  total_amount: number;
  shipping_address: string;
  payment_method: string;
  order_status: string;
  payment_status?: string;
  payment_url?: string;
  discount_amount?: number;
  note?: string;
  updated_at?: string;
  items: ApiOrderItem[];
};

export function normalizeBook(raw: unknown): ApiBook {
  const book = (raw ?? {}) as AnyRecord;

  return {
    id: asString(book.id),
    title: asString(book.title),
    author_name: asString(book.author_name ?? book.authorName),
    original_price: asNumber(book.original_price ?? book.originalPrice),
    selling_price: asNumber(book.selling_price ?? book.sellingPrice),
    category_name: asString(book.category_name ?? book.categoryName),
    cover_image: asString(book.cover_image ?? book.coverImage),
    sold_count: asNumber(book.sold_count ?? book.soldCount),
    rental_count: asNumber(book.rental_count ?? book.rentalCount),
    total_stock: asNumber(book.total_stock ?? book.totalStock),
    description:
      typeof book.description === "string" ? book.description : undefined,
    long_description:
      typeof book.long_description === "string"
        ? book.long_description
        : typeof book.longDescription === "string"
          ? book.longDescription
          : undefined,
    gallery_images: asStringArray(book.gallery_images ?? book.galleryImages),
    publisher_id:
      book.publisher_id !== undefined
        ? asNumber(book.publisher_id)
        : book.publisherId !== undefined
          ? asNumber(book.publisherId)
          : null,
    publication_year:
      book.publication_year !== undefined
        ? asNumber(book.publication_year)
        : book.publicationYear !== undefined
          ? asNumber(book.publicationYear)
          : null,
    language: asString(book.language),
    status: book.status !== undefined ? asNumber(book.status) : 1,
  };
}

export function normalizeUser(raw: unknown): ApiUser {
  const user = (raw ?? {}) as AnyRecord;

  return {
    id: asString(user.id),
    username: asString(user.username),
    email: asString(user.email),
    full_name: asString(user.full_name ?? user.fullName),
    phone: typeof user.phone === "string" ? user.phone : undefined,
    address: asString(user.address),
    role_id:
      user.role_id !== undefined
        ? asNumber(user.role_id)
        : user.roleId !== undefined
          ? asNumber(user.roleId)
          : undefined,
    status:
      user.status !== undefined
        ? asNumber(user.status)
        : user.isActive !== undefined
          ? asNumber(user.isActive)
          : undefined,
    total_points:
      user.total_points !== undefined
        ? asNumber(user.total_points)
        : user.totalPoints !== undefined
          ? asNumber(user.totalPoints)
          : undefined,
  };
}

export function normalizeOrderItem(raw: unknown): ApiOrderItem {
  const item = (raw ?? {}) as AnyRecord;

  return {
    book_item_id: asString(
      item.book_item_id ?? item.bookItemId ?? item.book_id ?? item.bookId,
    ),
    title: asString(item.title),
    unit_price: asNumber(item.unit_price ?? item.unitPrice),
    quantity: Math.max(1, asNumber(item.quantity, 1)),
  };
}

export function normalizeOrder(raw: unknown): ApiOrder {
  const envelope = asRecord(raw) ?? {};
  const order =
    asRecord(envelope.order) ??
    asRecord(envelope.orderDto) ??
    asRecord(envelope.orderDTO) ??
    asRecord(envelope.orderResponse) ??
    asRecord(envelope.orderData) ??
    asRecord(envelope.data) ??
    envelope;

  const itemsRaw =
    order.items ??
    order.orderItems ??
    order.order_details ??
    order.orderDetails ??
    envelope.items ??
    envelope.orderItems;

  return {
    id: asString(order.id ?? order.order_id ?? order.orderId),
    user_id: asString(order.user_id ?? order.userId),
    order_date: asString(order.order_date ?? order.orderDate ?? order.created_at ?? order.createdAt),
    total_amount: asNumber(order.total_amount ?? order.totalAmount ?? order.amount),
    shipping_address: asString(order.shipping_address ?? order.shippingAddress),
    payment_method: asString(order.payment_method ?? order.paymentMethod),
    order_status: asString(order.order_status ?? order.orderStatus ?? order.status),
    payment_status: asString(order.payment_status ?? order.paymentStatus),
    payment_url: extractPaymentUrl(raw),
    discount_amount: asNumber(order.discount_amount ?? order.discountAmount),
    note: asString(order.note),
    updated_at: asString(order.updated_at ?? order.updatedAt),
    items: Array.isArray(itemsRaw)
      ? itemsRaw.map((entry) => normalizeOrderItem(entry))
      : [],
  };
}

export function normalizeLoginResponse(raw: unknown): {
  accessToken: string;
  user: ApiUser | null;
} {
  const response = (raw ?? {}) as AnyRecord;
  const payload = (
    typeof response.data === "object" && response.data !== null
      ? (response.data as AnyRecord)
      : response
  ) as AnyRecord;
  const result =
    typeof payload.result === "object" && payload.result !== null
      ? (payload.result as AnyRecord)
      : ({} as AnyRecord);

  const token = asString(
    result.access_token ??
      result.accessToken ??
      payload.access_token ??
      payload.accessToken ??
      response.access_token ??
      response.accessToken ??
      response.token ??
      response.jwt ??
      "",
  );
  const userPayload =
    result.user ??
    payload.user ??
    payload.account ??
    response.user ??
    response.account ??
    null;

  return {
    accessToken: token,
    user: userPayload ? normalizeUser(userPayload) : null,
  };
}
