import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  addCampaignItem,
  createCampaign,
  deleteCampaign,
  getCampaignItems,
  getCampaigns,
  type FlashSaleCampaign,
  type FlashSaleCampaignItem,
} from "../../services/flashSaleAdminService";

type FlashSaleAdminState = {
  campaigns: FlashSaleCampaign[];
  itemsByCampaignId: Record<string, FlashSaleCampaignItem[]>;
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

export const fetchCampaigns = createAsyncThunk<
  FlashSaleCampaign[],
  void,
  { rejectValue: string }
>("flashSaleAdmin/fetchCampaigns", async (_: void, { rejectWithValue }) => {
  try {
    const response = await getCampaigns();
    return Array.isArray(response) ? response : [];
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const createFlashSaleCampaign = createAsyncThunk<
  FlashSaleCampaign,
  Record<string, unknown>,
  { rejectValue: string }
>(
  "flashSaleAdmin/createFlashSaleCampaign",
  async (payload, { rejectWithValue }) => {
    try {
      return await createCampaign(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchCampaignItems = createAsyncThunk<
  { campaignId: string; items: FlashSaleCampaignItem[] },
  string,
  { rejectValue: string }
>(
  "flashSaleAdmin/fetchCampaignItems",
  async (campaignId, { rejectWithValue }) => {
    try {
      const response = await getCampaignItems(campaignId);
      return {
        campaignId,
        items: Array.isArray(response) ? response : [],
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const addFlashSaleCampaignItem = createAsyncThunk<
  { campaignId: string; item: FlashSaleCampaignItem },
  { campaignId: string; payload: Record<string, unknown> },
  { rejectValue: string }
>(
  "flashSaleAdmin/addFlashSaleCampaignItem",
  async ({ campaignId, payload }, { rejectWithValue }) => {
    try {
      const item = await addCampaignItem(campaignId, payload);
      return { campaignId, item };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deleteFlashSaleCampaign = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  "flashSaleAdmin/deleteFlashSaleCampaign",
  async (campaignId, { rejectWithValue }) => {
    try {
      await deleteCampaign(campaignId);
      return campaignId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const initialState: FlashSaleAdminState = {
  campaigns: [],
  itemsByCampaignId: {},
  loading: false,
  saving: false,
  error: "",
};

const flashSaleAdminSlice = createSlice({
  name: "flashSaleAdmin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCampaigns.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = action.payload;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Không tải được campaign.";
      })
      .addCase(createFlashSaleCampaign.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(createFlashSaleCampaign.fulfilled, (state, action) => {
        state.saving = false;
        state.campaigns = [action.payload, ...state.campaigns];
      })
      .addCase(createFlashSaleCampaign.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không tạo được campaign.";
      })
      .addCase(fetchCampaignItems.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchCampaignItems.fulfilled, (state, action) => {
        state.loading = false;
        state.itemsByCampaignId[action.payload.campaignId] =
          action.payload.items;
      })
      .addCase(fetchCampaignItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Không tải được sản phẩm flash sale.";
      })
      .addCase(addFlashSaleCampaignItem.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(addFlashSaleCampaignItem.fulfilled, (state, action) => {
        state.saving = false;
        const current =
          state.itemsByCampaignId[action.payload.campaignId] ?? [];
        state.itemsByCampaignId[action.payload.campaignId] = [
          action.payload.item,
          ...current,
        ];
      })
      .addCase(addFlashSaleCampaignItem.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Không thêm được sản phẩm.";
      })
      .addCase(deleteFlashSaleCampaign.pending, (state) => {
        state.saving = true;
        state.error = "";
      })
      .addCase(deleteFlashSaleCampaign.fulfilled, (state, action) => {
        state.saving = false;
        state.campaigns = state.campaigns.filter(
          (campaign) => campaign.id !== action.payload,
        );
        delete state.itemsByCampaignId[action.payload];
      })
      .addCase(deleteFlashSaleCampaign.rejected, (state) => {
        state.saving = false;
      });
  },
});

export default flashSaleAdminSlice.reducer;
