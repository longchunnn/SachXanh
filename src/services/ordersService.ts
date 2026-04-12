import axiosClient from "./axiosClient";
import { normalizeOrder, type ApiOrder } from "../utils/apiMappers";

type CreateOrderPayload = Record<string, unknown>;

export async function getOrders(): Promise<ApiOrder[]> {
  const response = (await axiosClient.get("/orders")) as unknown;
  if (!Array.isArray(response)) return [];
  return response.map((entry) => normalizeOrder(entry));
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<ApiOrder> {
  const response = (await axiosClient.post("/orders", payload)) as unknown;
  return normalizeOrder(response);
}
