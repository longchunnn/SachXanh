import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ApiBook } from "../../utils/apiMappers";
import {
  createBook,
  getBooksForStaff,
  updateBookPartial,
} from "../../services/booksService";

type AdminBooksState = {
  items: ApiBook[];
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

export const fetchAdminBooks = createAsyncThunk<
  ApiBook[],
  { q?: string } | void,
  { rejectValue: string }
>("adminBooks/fetchAdminBooks", async (params, { rejectWithValue }) => {
  try {
    const response = await getBooksForStaff({
      q: typeof params === "object" && params ? params.q : undefined,
    });
    return Array.isArray(response) ? response : [];
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const createAdminBook = createAsyncThunk<
  ApiBook,
  Record<string, unknown>,
  { rejectValue: string }
>("adminBooks/createAdminBook", async (payload, { rejectWithValue }) => {
  try {
    return await createBook(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const updateAdminBook = createAsyncThunk<
  ApiBook,
  { bookId: string; payload: Record<string, unknown> },
  { rejectValue: string }
>("adminBooks/updateAdminBook", async ({ bookId, payload }, { rejectWithValue }) => {
  try {
    return await updateBookPartial(bookId, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const initialState: AdminBooksState = {
  items: [],
  loading: false,
  saving: false,
  error: "",
};

const adminBooksSlice = createSlice({
  name: "adminBooks",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminBooks.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchAdminBooks.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAdminBooks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Không tải được danh sách sách.";
      })
      .addCase(createAdminBook.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(createAdminBook.fulfilled, (state, action) => {
        state.saving = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(createAdminBook.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không thêm được sách.";
      })
      .addCase(updateAdminBook.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(updateAdminBook.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(updateAdminBook.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không cập nhật được sách.";
      });
  },
});

export default adminBooksSlice.reducer;
