import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type SearchUiState = {
  query: string;
  category: string;
  author: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
  page: number;
  debouncedQuery: string;
};

const initialState: SearchUiState = {
  query: "",
  category: "",
  author: "",
  minPrice: "",
  maxPrice: "",
  sort: "",
  page: 1,
  debouncedQuery: "",
};

type SyncPayload = {
  query: string;
  category: string;
  author: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
  page: number;
};

const searchUiSlice = createSlice({
  name: "searchUi",
  initialState,
  reducers: {
    syncFromParams(state, action: PayloadAction<SyncPayload>) {
      state.query = action.payload.query;
      state.category = action.payload.category;
      state.author = action.payload.author;
      state.minPrice = action.payload.minPrice;
      state.maxPrice = action.payload.maxPrice;
      state.sort = action.payload.sort;
      state.page = action.payload.page;
    },
    setDebouncedQuery(state, action: PayloadAction<string>) {
      state.debouncedQuery = action.payload;
    },
  },
});

export const { syncFromParams, setDebouncedQuery } = searchUiSlice.actions;
export default searchUiSlice.reducer;
