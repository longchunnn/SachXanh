import { configureStore } from "@reduxjs/toolkit";
import searchUiReducer from "./slices/searchUiSlice";

export const store = configureStore({
  reducer: {
    searchUi: searchUiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
