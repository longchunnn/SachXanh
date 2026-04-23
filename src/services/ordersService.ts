import axiosClient from "./axiosClient";
import { normalizeOrder, type ApiOrder } from "../utils/apiMappers";
import { unwrapPagedContent, unwrapResult } from "../utils/apiResponse";

type CreateOrderPayload = Record<string, unknown>;

export type OrderListParams = {
  page?: number;
  limit?: number;
  userId?: string;
  q?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export type UpdateOrderPayload = {
  order_status?: string;
  payment_status?: string;
  shipping_address?: string;
  payment_method?: string;
};

export async function getOrders(): Promise<ApiOrder[]> {
  const response = await axiosClient.get("/orders", {
    params: { _page: 0, _limit: 100, _sort: "orderId", _order: "desc" },
  });
  return unwrapPagedContent<unknown>(response).map((entry) =>
    normalizeOrder(entry),
  );
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<ApiOrder> {
  const response = await axiosClient.post("/orders", payload);
  return normalizeOrder(unwrapResult(response));
}

export async function getOrdersForStaff(
  params?: OrderListParams,
): Promise<ApiOrder[]> {
  const response = await axiosClient.get("/orders", {
    params: {
      _page: params?.page ?? 0,
      _limit: params?.limit ?? 200,
      _sort: params?.sort ?? "createdAt",
      _order: params?.order ?? "desc",
      user_id: params?.userId,
      q: params?.q,
      order_status: params?.orderStatus,
      payment_status: params?.paymentStatus,
      payment_method: params?.paymentMethod,
    },
  });
  return unwrapPagedContent<unknown>(response).map((entry) =>
    normalizeOrder(entry),
  );
}

export async function updateOrderStatus(
  orderId: string,
  payload: UpdateOrderPayload,
): Promise<ApiOrder> {
  const response = await axiosClient.patch(
    `/orders/${encodeURIComponent(orderId)}`,
    payload,
  );
  return normalizeOrder(unwrapResult(response));
}
