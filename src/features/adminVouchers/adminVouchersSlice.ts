import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  createVoucher,
  getVouchers,
  updateVoucherPartial,
  type ApiVoucher,
} from "../../services/vouchersService";

type AdminVouchersState = {
  items: ApiVoucher[];
  loading: boolean;
  saving: boolean;
  error: string;
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Thao tác thất bại.";
}

export const fetchAdminVouchers = createAsyncThunk<
  ApiVoucher[],
  void,
  { rejectValue: string }
>("adminVouchers/fetchAdminVouchers", async (_: void, { rejectWithValue }) => {
  try {
    const response = await getVouchers();
    return Array.isArray(response) ? response : [];
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const createAdminVoucher = createAsyncThunk<
  ApiVoucher,
  Record<string, unknown>,
  { rejectValue: string }
>("adminVouchers/createAdminVoucher", async (payload, { rejectWithValue }) => {
  try {
    return await createVoucher(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const updateAdminVoucher = createAsyncThunk<
  ApiVoucher,
  { voucherId: string; payload: Record<string, unknown> },
  { rejectValue: string }
>(
  "adminVouchers/updateAdminVoucher",
  async ({ voucherId, payload }, { rejectWithValue }) => {
    try {
      return await updateVoucherPartial(voucherId, payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const initialState: AdminVouchersState = {
  items: [],
  loading: false,
  saving: false,
  error: "",
};

const adminVouchersSlice = createSlice({
  name: "adminVouchers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminVouchers.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchAdminVouchers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAdminVouchers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Không tải được mã giảm giá.";
      })
      .addCase(createAdminVoucher.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(createAdminVoucher.fulfilled, (state, action) => {
        state.saving = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(createAdminVoucher.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không tạo được mã.";
      })
      .addCase(updateAdminVoucher.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(updateAdminVoucher.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(updateAdminVoucher.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không lưu được mã.";
      });
  },
});

export default adminVouchersSlice.reducer;
