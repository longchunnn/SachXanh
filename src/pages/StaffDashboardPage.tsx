import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs } from "antd";
import { toast } from "react-toastify";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import { useAppSelector } from "../app/hooks";
import {
  getStaffDashboardSummary,
  type StaffDashboardSummary,
} from "../services/staffService";
import {
  getOrdersForStaff,
  updateOrderStatus,
} from "../services/ordersService";
import { getBooksForStaff, updateBookPartial } from "../services/booksService";
import { getUsersForStaff } from "../services/usersService";
import type { ApiBook, ApiOrder, ApiUser } from "../utils/apiMappers";
import { ensureFirebaseChatLogin } from "../firebase/chatAuth";
import {
  listenAssignedConversations,
  listenMessages,
  sendConversationMessage,
  upsertStaffStatus,
  type ChatConversation,
  type ChatMessage,
} from "../firebase/chatService";
import {
  claimWaitingConversation,
  closeSupportConversation,
} from "../services/supportService";

const MAX_ACTIVE_CHATS = 3;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(
  value?: ChatConversation["updatedAt"] | ChatMessage["createdAt"] | string,
) {
  let date: Date | null = null;
  if (typeof value === "string") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === "object" &&
    value &&
    typeof value.seconds === "number"
  ) {
    date = new Date(value.seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SummaryCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-teal-800">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{note}</p>
    </div>
  );
}

export default function StaffDashboardPage() {
  const displayName = useAppSelector((state) => state.session.displayName);
  const userId = useAppSelector((state) => state.session.userId);
  const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [staffUid, setStaffUid] = useState("");
  const [assignedConversations, setAssignedConversations] = useState<
    ChatConversation[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [bookDrafts, setBookDrafts] = useState<
    Record<string, { total_stock: string; description: string }>
  >({});
  const [isBootstrappingChat, setIsBootstrappingChat] = useState(false);

  useEffect(() => {
    Promise.all([
      getStaffDashboardSummary(),
      getOrdersForStaff(),
      getBooksForStaff(),
      getUsersForStaff(),
    ])
      .then(([summaryResponse, orderResponse, bookResponse, userResponse]) => {
        setSummary(summaryResponse);
        setOrders(orderResponse);
        setBooks(bookResponse);
        setUsers(userResponse.filter((user) => Number(user.role_id) === 3));
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu nhân viên.",
        );
      });
  }, []);

  useEffect(() => {
    if (!chatEnabled) return;

    let cancelled = false;
    ensureFirebaseChatLogin()
      .then(async (uid) => {
        if (cancelled) return;
        setStaffUid(uid);
        await upsertStaffStatus({
          staffUid: uid,
          staffId: userId,
          staffName: displayName || "Nhân viên",
          acceptingChats: true,
          maxLoad: MAX_ACTIVE_CHATS,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Không kết nối được Firebase chat.",
          );
          setChatEnabled(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsBootstrappingChat(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatEnabled, displayName, userId]);

  useEffect(() => {
    if (chatEnabled) return;
    if (!staffUid) return;

    void upsertStaffStatus({
      staffUid,
      staffId: userId,
      staffName: displayName || "Nhân viên",
      acceptingChats: false,
      maxLoad: MAX_ACTIVE_CHATS,
    }).catch(() => undefined);
  }, [chatEnabled, displayName, staffUid, userId]);

  useEffect(() => {
    if (!chatEnabled) return;
    let unsubscribe: undefined | (() => void);
    listenAssignedConversations((items) => {
      setAssignedConversations(items);
      setSelectedConversationId((current) => current || items[0]?.id || "");
    })
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được cuộc trò chuyện được giao.",
        );
      });

    return () => {
      unsubscribe?.();
    };
  }, [chatEnabled]);

  useEffect(() => {
    if (!chatEnabled || !staffUid) return;

    const heartbeat = () => {
      void upsertStaffStatus({
        staffUid,
        staffId: userId,
        staffName: displayName || "Nhân viên",
        acceptingChats: true,
        maxLoad: MAX_ACTIVE_CHATS,
      }).catch(() => undefined);
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 45000);
    return () => {
      window.clearInterval(timer);
    };
  }, [chatEnabled, displayName, staffUid, userId]);

  useEffect(() => {
    if (!chatEnabled || !selectedConversationId) return;

    let unsubscribe: undefined | (() => void);
    listenMessages(selectedConversationId, setMessages)
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được tin nhắn hỗ trợ.",
        );
      });

    return () => {
      unsubscribe?.();
    };
  }, [chatEnabled, selectedConversationId]);

  useEffect(() => {
    if (!chatEnabled || !staffUid) return;

    const activeCount = assignedConversations.filter(
      (item) => item.status === "ACTIVE",
    ).length;
    if (activeCount >= MAX_ACTIVE_CHATS) return;

    let cancelled = false;
    const runClaim = async () => {
      try {
        const response = await claimWaitingConversation();
        if (
          !cancelled &&
          response?.conversation_id &&
          response.status === "ACTIVE"
        ) {
          // assignedConversations se duoc cap nhat realtime qua Firestore listener
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void runClaim();
    const timer = window.setInterval(() => {
      void runClaim();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [assignedConversations, chatEnabled, staffUid]);

  const activeConversation = useMemo(
    () =>
      assignedConversations.find(
        (item) => item.id === selectedConversationId,
      ) ?? null,
    [assignedConversations, selectedConversationId],
  );

  async function handleUpdateOrderStatus(orderId: string, orderStatus: string) {
    try {
      const updated = await updateOrderStatus(orderId, {
        order_status: orderStatus,
      });
      setOrders((current) =>
        current.map((item) => (item.id === orderId ? updated : item)),
      );
      toast.success("Đã cập nhật trạng thái đơn hàng.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không cập nhật được đơn hàng.",
      );
    }
  }

  async function handleSaveBook(bookId: string) {
    const draft = bookDrafts[bookId];
    if (!draft) return;

    try {
      const updated = await updateBookPartial(bookId, {
        total_stock: Number(draft.total_stock || 0),
        description: draft.description,
      });
      setBooks((current) =>
        current.map((item) => (item.id === bookId ? updated : item)),
      );
      toast.success("Đã cập nhật thông tin sách.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không cập nhật được sách.",
      );
    }
  }

  async function handleSendChat() {
    if (!selectedConversationId || !chatDraft.trim()) return;
    try {
      await sendConversationMessage(
        selectedConversationId,
        chatDraft,
        "STAFF",
        displayName || "Nhân viên",
      );
      setChatDraft("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không gửi được tin nhắn.",
      );
    }
  }

  async function handleCloseConversation() {
    if (!selectedConversationId) return;
    try {
      await closeSupportConversation(selectedConversationId);
      toast.success("Đã đóng cuộc trò chuyện.");
      if (chatEnabled && staffUid) {
        await claimWaitingConversation();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không đóng được cuộc trò chuyện.",
      );
    }
  }

  const items = [
    {
      key: "overview",
      label: "Tổng quan",
      children: (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Đầu sách"
            value={summary?.total_books ?? 0}
            note="Tổng số đầu sách đang quản lý"
          />
          <SummaryCard
            title="Đơn hàng"
            value={summary?.total_orders ?? 0}
            note="Tất cả đơn hàng hệ thống"
          />
          <SummaryCard
            title="Chờ duyệt"
            value={summary?.pending_orders ?? 0}
            note="Đơn cần staff xử lý"
          />
          <SummaryCard
            title="Đang giao"
            value={summary?.shipping_orders ?? 0}
            note="Đơn đang vận chuyển"
          />
          <SummaryCard
            title="Khách hàng"
            value={summary?.total_customers ?? 0}
            note="Tài khoản user đang hoạt động"
          />
        </div>
      ),
    },
    {
      key: "orders",
      label: "Đơn hàng",
      children: (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-teal-900">
                    Đơn #{order.id}
                  </p>
                  <p className="text-sm text-gray-500">
                    Khách hàng ID: {order.user_id} • {order.shipping_address}
                  </p>
                  <p className="text-sm text-gray-500">
                    Thanh toán: {order.payment_method}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={order.order_status}
                    onChange={(event) =>
                      void handleUpdateOrderStatus(order.id, event.target.value)
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    {[
                      "Cho duyet",
                      "Dang xu ly",
                      "Dang giao",
                      "Da giao",
                      "Da huy",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-semibold text-teal-800">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.book_item_id}`}>
                    {item.title} × {item.quantity} —{" "}
                    {formatCurrency(item.unit_price)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "books",
      label: "Sách",
      children: (
        <div className="space-y-4">
          {books.map((book) => {
            const draft = bookDrafts[book.id] ?? {
              total_stock: String(book.total_stock ?? 0),
              description: book.description ?? "",
            };
            return (
              <div
                key={book.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-4 lg:grid-cols-[1.6fr,1fr,1fr,auto] lg:items-center">
                  <div>
                    <p className="text-lg font-semibold text-teal-900">
                      {book.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {book.author_name} • {book.category_name}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tồn kho
                    </label>
                    <input
                      value={draft.total_stock}
                      onChange={(event) =>
                        setBookDrafts((current) => ({
                          ...current,
                          [book.id]: {
                            ...draft,
                            total_stock: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mô tả ngắn
                    </label>
                    <input
                      value={draft.description}
                      onChange={(event) =>
                        setBookDrafts((current) => ({
                          ...current,
                          [book.id]: {
                            ...draft,
                            description: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void handleSaveBook(book.id)}
                      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: "customers",
      label: "Khách hàng",
      children: (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Điện thoại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-teal-900">
                    #{user.id}
                  </td>
                  <td className="px-4 py-3">{user.full_name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "chat",
      label: "Chat hỗ trợ",
      children: (
        <div className="grid gap-4 lg:grid-cols-[22rem,1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-teal-900">
                  Trạng thái tiếp nhận
                </p>
                <p className="text-sm text-gray-500">
                  Bật để nhận yêu cầu hỗ trợ mới
                </p>
              </div>
              <button
                type="button"
                disabled={isBootstrappingChat}
                onClick={() => {
                  if (chatEnabled) {
                    setChatEnabled(false);
                    setIsBootstrappingChat(false);
                    setSelectedConversationId("");
                    setMessages([]);
                    return;
                  }

                  setIsBootstrappingChat(true);
                  setChatEnabled(true);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${chatEnabled ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                {chatEnabled ? "Đang nhận chat" : "Tạm dừng"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {assignedConversations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                  Chưa có cuộc trò chuyện nào được giao.
                </p>
              ) : (
                assignedConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setMessages([]);
                    }}
                    className={`block w-full rounded-2xl border px-3 py-3 text-left transition ${selectedConversationId === conversation.id ? "border-teal-700 bg-teal-50" : "border-gray-200 hover:border-teal-200"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-teal-900">
                          {conversation.userName ||
                            `User #${conversation.userId}`}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {conversation.lastMessage || "Chưa có tin nhắn"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-teal-700">
                        {conversation.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {formatDateTime(conversation.updatedAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex h-168 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-lg font-semibold text-teal-900">
                  {activeConversation?.userName || "Chọn một cuộc trò chuyện"}
                </p>
                <p className="text-sm text-gray-500">
                  {activeConversation
                    ? `Trạng thái: ${activeConversation.status}`
                    : "Không có hội thoại được chọn"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCloseConversation()}
                disabled={
                  !activeConversation || activeConversation.status === "CLOSED"
                }
                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Đóng hội thoại
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
              {messages.map((message) => {
                const mine = message.senderRole === "STAFF";
                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-teal-700 text-white" : "bg-white text-gray-700"}`}
                    >
                      {!mine && message.senderName ? (
                        <p className="mb-1 text-xs font-semibold text-teal-700">
                          {message.senderName}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </p>
                      <p
                        className={`mt-2 text-[11px] ${mine ? "text-teal-100" : "text-gray-400"}`}
                      >
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {activeConversation && messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400">
                  Khách hàng chưa gửi thêm tin nhắn nào.
                </p>
              ) : null}
            </div>

            <div className="border-t border-gray-100 p-4">
              <div className="flex gap-3">
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={2}
                  disabled={
                    !activeConversation ||
                    activeConversation.status === "CLOSED"
                  }
                  placeholder="Nhập phản hồi cho khách hàng..."
                  className="min-h-13 flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-teal-600 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => void handleSendChat()}
                  disabled={
                    !activeConversation ||
                    activeConversation.status === "CLOSED"
                  }
                  className="rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Khu vực nhân viên
            </p>
            <h1 className="text-3xl font-bold text-teal-900">
              Bảng điều khiển staff
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Xin chào {displayName || "nhân viên"}, bạn có thể quản lý đơn
              hàng, cập nhật sách và hỗ trợ khách hàng tại đây.
            </p>
          </div>
          <Link
            to="/account"
            className="inline-flex rounded-2xl border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
          >
            Quay lại tài khoản
          </Link>
        </div>

        <Tabs
          defaultActiveKey="overview"
          items={items}
          className="rounded-2xl bg-white p-4 shadow-sm"
        />
      </main>
      <Footer />
    </div>
  );
}
