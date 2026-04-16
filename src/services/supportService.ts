import axiosClient from "./axiosClient";
import { unwrapResult } from "../utils/apiResponse";

export type SupportConversationResponse = {
  conversation_id: string;
  status: string;
  staff_uid?: string;
  staff_id?: number;
  staff_name?: string;
  message: string;
};

export async function openSupportConversation(message: string) {
  const response = await axiosClient.post("/support/open", { message });
  return unwrapResult<SupportConversationResponse>(response);
}

export async function closeSupportConversation(conversationId: string) {
  const response = await axiosClient.patch(
    `/support/${encodeURIComponent(conversationId)}/close`,
  );
  return unwrapResult<SupportConversationResponse>(response);
}

export async function claimWaitingConversation() {
  const response = await axiosClient.post("/support/claim-waiting");
  return unwrapResult<SupportConversationResponse>(response);
}
