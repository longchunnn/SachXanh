import axiosClient from "./axiosClient";

export interface BookSuggestion {
  book_id: number;
  title: string;
  authors: string;
  selling_price: number;
  flash_sale_price?: number;
  flash_sale_name?: string;
  promotion_code?: string;
  discount_percent?: number;
  total_stock: number;
}

export interface ChatbotResponse {
  answer: string;
  intent: string;
  books: BookSuggestion[];
  promotion_info?: string;
  flash_sale_info?: string;
  has_results: boolean;
}

export interface ChatSession {
  session_id: number;
  status: string;
  started_at: string;
  user_id?: number | null;
}

export interface ChatMessage {
  message_id: number;
  sender_type: "USER" | "BOT";
  content: string;
  created_at: string;
}

export interface ChatSessionResponse {
  code: number;
  message: string;
  result: ChatSession;
}

export interface ChatMessageListResponse {
  code: number;
  message: string;
  result: ChatMessage[];
}

export interface ChatbotApiResponse {
  code: number;
  message: string;
  result: ChatbotResponse;
}

export async function createChatSession(): Promise<ChatSessionResponse> {
  return await axiosClient.post("/chatbot/session");
}

export async function sendChatMessage(sessionId: number, message: string): Promise<ChatbotApiResponse> {
  return await axiosClient.post("/chatbot/chat", {
    sessionId,
    message,
  });
}

export async function getChatHistory(sessionId: number): Promise<ChatMessageListResponse> {
  return await axiosClient.get(`/chatbot/history/${sessionId}`);
}

export async function closeChatSession(sessionId: number): Promise<void> {
  await axiosClient.delete(`/chatbot/session/${sessionId}`);
}
