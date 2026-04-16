import axiosClient from "./axiosClient";
import { unwrapResult } from "../utils/apiResponse";

export type StaffDashboardSummary = {
  total_books: number;
  total_orders: number;
  pending_orders: number;
  shipping_orders: number;
  total_customers: number;
};

export async function getStaffDashboardSummary() {
  const response = await axiosClient.get("/staff/dashboard/summary");
  return unwrapResult<StaffDashboardSummary>(response);
}
