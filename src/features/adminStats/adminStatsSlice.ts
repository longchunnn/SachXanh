import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getOrdersForStaff } from "../../services/ordersService";
import type { ApiOrder } from "../../utils/apiMappers";

type AdminStatsState = {
  orders: ApiOrder[];
  loading: boolean;
  error: string;
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Không tải được dữ liệu thống kê.";
}

export const fetchAdminOrders = createAsyncThunk<
  ApiOrder[],
  void,
  { rejectValue: string }
>("adminStats/fetchAdminOrders", async (_: void, { rejectWithValue }) => {
  try {
    const response = await getOrdersForStaff();
    return Array.isArray(response) ? response : [];
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const initialState: AdminStatsState = {
  orders: [],
  loading: false,
  error: "",
};

const adminStatsSlice = createSlice({
  name: "adminStats",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminOrders.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchAdminOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Không tải được dữ liệu thống kê.";
      });
  },
});

export default adminStatsSlice.reducer;
