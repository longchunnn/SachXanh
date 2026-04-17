import { useEffect, useRef, useState } from "react";
import {
  CloseOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import {
  createChatSession,
  getChatHistory,
  sendChatMessage,
} from "../../services/chatbotService";
import type { ChatMessage, BookSuggestion } from "../../services/chatbotService";
import { useAppSelector } from "../../app/hooks";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<(ChatMessage | { isLocalError?: boolean; content: string })[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = useAppSelector((state) => state.session.token); // React to login/logout

  // First time open or session setup
  useEffect(() => {
    if (isOpen && !sessionId) {
      initSession();
    }
  }, [isOpen]);

  // Logout/Login -> clear session to get a new one bounded to new user
  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    if (isOpen) {
      initSession();
    }
  }, [token]);

  const initSession = async () => {
    try {
      setIsLoading(true);
      const res = await createChatSession();
      if (res && res.result && res.result.session_id) {
        setSessionId(res.result.session_id);
        const historyRes = await getChatHistory(res.result.session_id);
        if (historyRes?.result?.length) {
          setMessages(historyRes.result);
        } else {
          setMessages([
            {
              message_id: 0,
              sender_type: "BOT",
              content: "Xin chào! Mình là Sách Xanh AI, rất vui được hỗ trợ bạn tìm những cuốn sách tuyệt vời nhất hôm nay. Bạn đang tìm sách gì ạ?",
              created_at: new Date().toISOString()
            }
          ]);
        }
      }
    } catch (error) {
      toast.error("Không thể kết nối tới Sách Xanh AI. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || !sessionId || isLoading) return;

    setInputValue("");
    const newMsg: ChatMessage = {
      message_id: Date.now(), // temporary
      sender_type: "USER",
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newMsg]);

    try {
      setIsLoading(true);
      const res = await sendChatMessage(sessionId, text);
      
      let botContent = res.result?.answer || "Xin lỗi, hiện tại tôi gặp sự cố.";
      
      // Highlight promotions or flash sales
      if (res.result?.flash_sale_info) {
        botContent += `\n\n⚡ ${res.result.flash_sale_info}`;
      }
      if (res.result?.promotion_info) {
        botContent += `\n\n🎁 ${res.result.promotion_info}`;
      }

      // Add Books
      if (res.result?.books && res.result.books.length > 0) {
        botContent += "\n\n📚 Mời bạn tham khảo:\n";
        res.result.books.forEach((b: BookSuggestion, idx: number) => {
          botContent += `${idx + 1}. ${b.title}`;
          if (b.flash_sale_price) {
             botContent += ` (⚡ Flash Sale ${b.flash_sale_price.toLocaleString()}đ)\n`;
          } else {
             botContent += ` - ${b.selling_price.toLocaleString()}đ\n`;
          }
        });
      }

      const botMsg: ChatMessage = {
        message_id: Date.now() + 1,
        sender_type: "BOT",
        content: botContent,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, botMsg]);

    } catch (error) {
       setMessages((prev) => [
          ...prev, 
          { isLocalError: true, content: "Lỗi kết nối hoặc AI đang quá tải. Hãy thử lại." }
       ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex items-end gap-3">
      {isOpen ? (
        <div className="flex h-[38rem] w-[24rem] flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <RobotOutlined className="text-xl" />
              <div>
                <p className="text-sm font-semibold">Sách Xanh AI Support</p>
                <p className="text-xs text-blue-100">Gợi ý sách, Flash Sale & hơn thế nữa</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/90 transition hover:bg-white/10"
            >
              <CloseOutlined />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
              <div className="space-y-3">
                {messages.map((message, i) => {
                  const mine = (message as ChatMessage).sender_type === "USER";
                  return (
                    <div
                      key={i}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap ${
                          mine
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 border border-gray-100"
                        } ${(message as any).isLocalError ? "bg-red-100 text-red-700 border-red-200" : ""}`}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-white border border-gray-100 px-4 py-2 text-sm text-gray-500 shadow-sm flex items-center gap-2">
                      <LoadingOutlined /> AI đang suy nghĩ...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="mt-auto border-t border-gray-100 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Gửi câu hỏi cho chatbot..."
                  disabled={isLoading || !sessionId}
                  className="h-11 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isLoading || !sessionId || !inputValue.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SendOutlined />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        title="Trợ lý Sách Xanh AI"
      >
        <RobotOutlined className="text-xl transition group-hover:scale-110" />
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-blue-600 shadow">
          <ThunderboltOutlined />
        </span>
      </button>
    </div>
  );
}
