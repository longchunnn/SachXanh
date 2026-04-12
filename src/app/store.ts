import { configureStore } from "@reduxjs/toolkit";
import searchUiReducer from "../features/searchUi/searchUiSlice";
import sessionReducer, {
  type ProfileForm,
  type SavedAddress,
} from "../features/session/sessionSlice";
import cartReducer from "../features/cart/cartSlice";
import booksReducer from "../features/books/booksSlice";
import voucherReducer from "../features/voucher/voucherSlice";
import { setStoreRef } from "./storeRef";

const TOKEN_KEY = "access_token";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function getStorageKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`;
}

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    cart: cartReducer,
    voucher: voucherReducer,
    books: booksReducer,
    searchUi: searchUiReducer,
  },
});

setStoreRef(store);

let previousSessionToken: string | null = store.getState().session.token;
let previousUserId = store.getState().session.userId;
let previousProfileForm: ProfileForm = store.getState().session.profileForm;
let previousSavedAddresses: SavedAddress[] =
  store.getState().session.savedAddresses;
let previousAvatarSrc = store.getState().session.avatarSrc;
let previousCartItems = store.getState().cart.items;
let previousCheckoutSession = store.getState().cart.checkoutSession;
let previousClaimedVouchers = store.getState().voucher.claimedVouchers;

store.subscribe(() => {
  if (!canUseStorage()) {
    return;
  }

  const state = store.getState();

  if (state.session.token !== previousSessionToken) {
    previousSessionToken = state.session.token;

    if (state.session.token) {
      localStorage.setItem(TOKEN_KEY, state.session.token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  if (state.session.userId !== previousUserId) {
    previousUserId = state.session.userId;
    previousProfileForm = state.session.profileForm;
    previousSavedAddresses = state.session.savedAddresses;
    previousAvatarSrc = state.session.avatarSrc;
    previousCartItems = state.cart.items;
    previousCheckoutSession = state.cart.checkoutSession;
    previousClaimedVouchers = state.voucher.claimedVouchers;
  }

  if (
    state.session.userId &&
    state.session.profileForm !== previousProfileForm
  ) {
    previousProfileForm = state.session.profileForm;
    localStorage.setItem(
      getStorageKey("bookstore_profile_form", state.session.userId),
      JSON.stringify(state.session.profileForm),
    );
  }

  if (
    state.session.userId &&
    state.session.savedAddresses !== previousSavedAddresses
  ) {
    previousSavedAddresses = state.session.savedAddresses;
    localStorage.setItem(
      getStorageKey("bookstore_saved_addresses", state.session.userId),
      JSON.stringify(state.session.savedAddresses),
    );
  }

  if (state.session.userId && state.session.avatarSrc !== previousAvatarSrc) {
    previousAvatarSrc = state.session.avatarSrc;
    localStorage.setItem(
      getStorageKey("bookstore_profile_avatar", state.session.userId),
      state.session.avatarSrc,
    );
  }

  if (state.session.userId && state.cart.items !== previousCartItems) {
    previousCartItems = state.cart.items;
    localStorage.setItem(
      getStorageKey("bookstore_cart_items", state.session.userId),
      JSON.stringify(state.cart.items),
    );
  }

  if (
    state.session.userId &&
    state.cart.checkoutSession !== previousCheckoutSession
  ) {
    previousCheckoutSession = state.cart.checkoutSession;
    if (state.cart.checkoutSession) {
      localStorage.setItem(
        getStorageKey("bookstore_checkout_session", state.session.userId),
        JSON.stringify(state.cart.checkoutSession),
      );
    } else {
      localStorage.removeItem(
        getStorageKey("bookstore_checkout_session", state.session.userId),
      );
    }
  }

  if (
    state.session.userId &&
    state.voucher.claimedVouchers !== previousClaimedVouchers
  ) {
    previousClaimedVouchers = state.voucher.claimedVouchers;
    localStorage.setItem(
      getStorageKey("bookstore_claimed_vouchers", state.session.userId),
      JSON.stringify(state.voucher.claimedVouchers),
    );
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
