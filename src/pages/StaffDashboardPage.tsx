import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../features/session/sessionSlice";
import { ensureFirebaseChatLogin } from "../firebase/chatAuth";
import {
  listenAssignedConversations,
  listenMessages,
  sendConversationMessage,
  setConversationLabels,
  upsertStaffStatus,
  type ChatConversation,
  type ChatMessage,
} from "../firebase/chatService";
import { getBooksForStaff, updateBookPartial } from "../services/booksService";
import { getCategories, type ApiCategory } from "../services/categoriesService";
import {
  getOrdersForStaff,
  updateOrderStatus,
} from "../services/ordersService";
import {
  getStaffDashboardSummary,
  type StaffDashboardSummary,
} from "../services/staffService";
import {
  claimWaitingConversation,
  closeSupportConversation,
} from "../services/supportService";
import { getCurrentUserProfile } from "../services/authService";
import { clearAccessToken } from "../services/axiosClient";
import { updateUser } from "../services/usersService";
import { signOutFirebaseUser } from "../firebase/client";
import type { ApiBook, ApiOrder, ApiUser } from "../utils/apiMappers";

const MAX_ACTIVE_CHATS = 999;

type SectionKey =
  | "overview"
  | "books"
  | "orders"
  | "inventory"
  | "chat"
  | "profile";

type QuickBookDraft = {
  total_stock: string;
  description: string;
};

type ProfileDraft = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
};

type ConversationGroup = {
  customerKey: string;
  userUid: string;
  userId?: number;
  userName: string;
  latestConversation: ChatConversation;
  conversations: ChatConversation[];
  labels: string[];
  unreadCount: number;
};

const CHAT_LABEL_SUGGESTIONS = [
  "Chờ phản hồi",
  "Đơn hàng",
  "Thanh toán",
  "Khiếu nại",
  "Tư vấn sách",
  "Ưu tiên",
  "VIP",
  "Hậu mãi",
];

function getConversationCustomerKey(conversation: ChatConversation): string {
  if (conversation.userUid) return `uid:${conversation.userUid}`;
  if (conversation.userId !== undefined && conversation.userId !== null)
    return `user:${conversation.userId}`;
  return `conversation:${conversation.id}`;
}

function normalizeChatLabels(labels?: string[] | null): string[] {
  return Array.from(
    new Set(
      (labels ?? []).map((item) => String(item || "").trim()).filter(Boolean),
    ),
  );
}

function buildConversationGroups(
  conversations: ChatConversation[],
): ConversationGroup[] {
  const grouped = new Map<string, ChatConversation[]>();

  conversations.forEach((conversation) => {
    const key = getConversationCustomerKey(conversation);
    const bucket = grouped.get(key) ?? [];
    bucket.push({
      ...conversation,
      labels: normalizeChatLabels(conversation.labels),
    });
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([customerKey, items]) => {
      const sorted = [...items].sort(
        (left, right) =>
          getTimeValue(right.updatedAt || right.lastMessageAt) -
          getTimeValue(left.updatedAt || left.lastMessageAt),
      );
      const latestConversation = sorted[0];
      const labels = normalizeChatLabels(
        sorted.flatMap((item) => item.labels ?? []),
      );
      const unreadCount = sorted.reduce(
        (total, item) => total + Number(item.unreadByStaff ?? 0),
        0,
      );
      return {
        customerKey,
        userUid: latestConversation.userUid,
        userId: latestConversation.userId,
        userName:
          latestConversation.userName ||
          `Khách hàng #${latestConversation.userId ?? latestConversation.id}`,
        latestConversation,
        conversations: sorted,
        labels,
        unreadCount,
      };
    })
    .sort(
      (left, right) =>
        getTimeValue(
          right.latestConversation.updatedAt ||
            right.latestConversation.lastMessageAt,
        ) -
        getTimeValue(
          left.latestConversation.updatedAt ||
            left.latestConversation.lastMessageAt,
        ),
    );
}

const BASIC_ORDER_STATUS_OPTIONS = [
  { value: "Cho duyet", label: "Chờ duyệt" },
  { value: "Dang xu ly", label: "Đang xử lý" },
  { value: "Dang giao", label: "Đang giao" },
  { value: "Đã giao", label: "Đã giao" },
  { value: "Thanh cong", label: "Thành công" },
  { value: "Đã hủy", label: "Đã hủy" },
];

const ADVANCED_PAYMENT_STATUS_OPTIONS = [
  { value: "Chua thanh toan", label: "Chưa thanh toán" },
  { value: "Đã thanh toán", label: "Đã thanh toán" },
  { value: "Thanh toan that bai", label: "Thanh toán thất bại" },
  { value: "Da hoan tien", label: "Đã hoàn tiền" },
];

const STAFF_MENU: Array<{ key: SectionKey; label: string; note: string }> = [
  { key: "overview", label: "Tổng quan", note: "Chỉ số nhanh" },
  { key: "books", label: "Sách", note: "Danh sách và thông tin sách" },
  { key: "orders", label: "Đơn hàng", note: "Theo dõi và cập nhật" },
  { key: "inventory", label: "Tồn kho", note: "Kiểm tra số lượng" },
  { key: "chat", label: "Chat hỗ trợ", note: "Hội thoại được giao" },
  { key: "profile", label: "Hồ sơ cá nhân", note: "Xem và chỉnh sửa" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(
  value?: string | Date | { seconds?: number; nanoseconds?: number } | null,
): string {
  let date: Date | null = null;

  if (typeof value === "string" && value.trim()) {
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

  if (!date || Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTimeValue(
  value?: string | Date | { seconds?: number; nanoseconds?: number } | null,
): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.seconds === "number")
    return value.seconds * 1000;
  return 0;
}

function buildProfileDraft(
  user?: {
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null,
): ProfileDraft {
  return {
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
  };
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
    <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{note}</p>
    </div>
  );
}

function SectionCard({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export default function StaffDashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const displayName = useAppSelector((state) => state.session.displayName);
  const userId = useAppSelector((state) => state.session.userId);
  const primaryRole = useAppSelector((state) => state.session.primaryRole);

  const canManageInventory = true;
  const canManagePayments = true;

  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [myProfile, setMyProfile] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [bookSearch, setBookSearch] = useState("");
  const [bookCategoryFilter, setBookCategoryFilter] = useState("all");
  const [bookStockFilter, setBookStockFilter] = useState("all");
  const [editingBookId, setEditingBookId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [quickBookDrafts, setQuickBookDrafts] = useState<
    Record<string, QuickBookDraft>
  >({});
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(
    buildProfileDraft(null),
  );

  const [staffUid, setStaffUid] = useState("");
  const [chatReady, setChatReady] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isBootstrappingChat, setIsBootstrappingChat] = useState(false);
  const [assignedConversations, setAssignedConversations] = useState<
    ChatConversation[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChatLabel, setSelectedChatLabel] = useState("all");
  const [customChatLabel, setCustomChatLabel] = useState("");

  const hasMountedUnreadRef = useRef(false);
  const unreadMapRef = useRef<Record<string, number>>({});

  const conversationGroups = useMemo(
    () => buildConversationGroups(assignedConversations),
    [assignedConversations],
  );

  const activeConversation = useMemo(
    () =>
      assignedConversations.find(
        (item) => item.id === selectedConversationId,
      ) ?? null,
    [assignedConversations, selectedConversationId],
  );

  const activeConversationCustomerKey = useMemo(
    () =>
      activeConversation ? getConversationCustomerKey(activeConversation) : "",
    [activeConversation],
  );

  const activeConversationGroup = useMemo(
    () =>
      conversationGroups.find(
        (group) => group.customerKey === activeConversationCustomerKey,
      ) ?? null,
    [activeConversationCustomerKey, conversationGroups],
  );

  const availableChatLabels = useMemo(
    () =>
      normalizeChatLabels([
        ...CHAT_LABEL_SUGGESTIONS,
        ...assignedConversations.flatMap((item) => item.labels ?? []),
      ]),
    [assignedConversations],
  );

  const filteredConversationGroups = useMemo(() => {
    const keyword = chatSearch.trim().toLowerCase();
    return conversationGroups.filter((group) => {
      const matchesKeyword =
        !keyword ||
        [
          group.userName,
          group.userId,
          group.latestConversation.lastMessage,
          ...group.conversations.map((item) => item.lastMessage),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesLabel =
        selectedChatLabel === "all" || group.labels.includes(selectedChatLabel);
      return matchesKeyword && matchesLabel;
    });
  }, [chatSearch, conversationGroups, selectedChatLabel]);

  const bookCategoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...categories.map((category) => category.name),
          ...books.map((book) => book.category_name),
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, "vi"));
  }, [books, categories]);

  const filteredBooks = useMemo(() => {
    const keyword = bookSearch.trim().toLowerCase();
    return books.filter((book) => {
      const text = [
        book.title,
        book.author_name,
        book.category_name,
        book.description,
        book.long_description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesKeyword = !keyword || text.includes(keyword);
      const matchesCategory =
        bookCategoryFilter === "all" || book.category_name === bookCategoryFilter;
      const stock = Number(book.total_stock ?? 0);
      const matchesStock =
        bookStockFilter === "all" ||
        (bookStockFilter === "out" && stock <= 0) ||
        (bookStockFilter === "low" && stock > 0 && stock <= 10) ||
        (bookStockFilter === "available" && stock > 10);
      return matchesKeyword && matchesCategory && matchesStock;
    });
  }, [bookCategoryFilter, bookSearch, bookStockFilter, books]);

  const filteredOrders = useMemo(() => {
    const keyword = orderSearch.trim().toLowerCase();
    if (!keyword) return orders;
    return orders.filter((order) => {
      const text = [
        order.id,
        order.user_id,
        order.shipping_address,
        order.payment_method,
        order.order_status,
        order.payment_status,
        ...order.items.map((item) => item.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [orderSearch, orders]);

  const lowStockBooks = useMemo(
    () => books.filter((book) => Number(book.total_stock ?? 0) <= 10),
    [books],
  );

  const unreadConversationCount = useMemo(
    () =>
      assignedConversations.filter(
        (item) => Number(item.unreadByStaff ?? 0) > 0,
      ).length,
    [assignedConversations],
  );

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const recentConversations = useMemo(
    () => conversationGroups.slice(0, 5),
    [conversationGroups],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      try {
        const [summaryResult, orderResult, bookResult, categoryResult, profileResult] =
          await Promise.allSettled([
            getStaffDashboardSummary(),
            getOrdersForStaff(),
            getBooksForStaff(),
            getCategories(),
            getCurrentUserProfile(),
          ]);

        if (!mounted) return;

        const nextSummary =
          summaryResult.status === "fulfilled" ? summaryResult.value : null;
        const nextOrders =
          orderResult.status === "fulfilled" ? orderResult.value : [];
        const nextBooks =
          bookResult.status === "fulfilled" ? bookResult.value : [];
        const nextCategories =
          categoryResult.status === "fulfilled" ? categoryResult.value : [];
        const nextProfile =
          profileResult.status === "fulfilled" ? profileResult.value : null;

        setSummary(nextSummary);
        setOrders(nextOrders);
        setBooks(nextBooks);
        setCategories(nextCategories);
        setMyProfile(nextProfile);
        setProfileDraft(buildProfileDraft(nextProfile));

        const failedParts = [
          summaryResult.status === "rejected" ? "tổng quan" : "",
          orderResult.status === "rejected" ? "đơn hàng" : "",
          bookResult.status === "rejected" ? "sách" : "",
          categoryResult.status === "rejected" ? "thể loại" : "",
          profileResult.status === "rejected" ? "hồ sơ" : "",
        ].filter(Boolean);

        if (failedParts.length > 0) {
          toast.warning(
            `Một số dữ liệu chưa tải được: ${failedParts.join(", ")}. Các phần còn lại vẫn hiển thị bình thường.`,
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu staff.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      setIsBootstrappingChat(true);
      setChatError("");
      try {
        const uid = await ensureFirebaseChatLogin();
        if (cancelled) return;
        setStaffUid(uid);
        setChatReady(true);

        await upsertStaffStatus({
          staffUid: uid,
          staffId: userId,
          staffName: displayName || "Nhân viên",
          acceptingChats: true,
          currentLoad: assignedConversations.filter(
            (item) => item.status === "ACTIVE",
          ).length,
          maxLoad: MAX_ACTIVE_CHATS,
        });
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Không khởi tạo được chat hỗ trợ.";
          setChatReady(false);
          setChatError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setIsBootstrappingChat(false);
      }
    }

    if (userId) {
      void initChat();
    }

    return () => {
      cancelled = true;
    };
  }, [displayName, userId]);

  useEffect(() => {
    if (!chatReady) return;

    let unsubscribe: undefined | (() => void);
    void listenAssignedConversations((items) => {
      setAssignedConversations(items);
      setSelectedConversationId((current) => {
        if (current && items.some((item) => item.id === current))
          return current;
        return buildConversationGroups(items)[0]?.latestConversation.id || "";
      });

      const nextUnreadMap: Record<string, number> = {};
      items.forEach((item) => {
        nextUnreadMap[item.id] = Number(item.unreadByStaff ?? 0);
      });

      if (hasMountedUnreadRef.current) {
        items.forEach((item) => {
          const previousUnread = unreadMapRef.current[item.id] ?? 0;
          const nextUnread = Number(item.unreadByStaff ?? 0);
          if (nextUnread > previousUnread) {
            toast.info(
              `Có tin nhắn mới từ ${item.userName || `khách hàng #${item.userId}`}.`,
            );
          }
        });
      }

      unreadMapRef.current = nextUnreadMap;
      hasMountedUnreadRef.current = true;
    })
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách hội thoại.",
        );
      });

    return () => {
      unsubscribe?.();
    };
  }, [chatReady]);

  useEffect(() => {
    if (!chatReady || !selectedConversationId) {
      setMessages([]);
      return;
    }

    let unsubscribe: undefined | (() => void);
    void listenMessages(selectedConversationId, (items) => {
      setMessages(items);
    })
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được tin nhắn hội thoại.",
        );
      });

    return () => {
      unsubscribe?.();
    };
  }, [chatReady, selectedConversationId]);

  useEffect(() => {
    if (!chatReady || !staffUid) return;

    const sendHeartbeat = () => {
      void upsertStaffStatus({
        staffUid,
        staffId: userId,
        staffName: displayName || "Nhân viên",
        acceptingChats: true,
        currentLoad: assignedConversations.filter(
          (item) => item.status === "ACTIVE",
        ).length,
        maxLoad: MAX_ACTIVE_CHATS,
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 45000);
    return () => {
      window.clearInterval(timer);
    };
  }, [assignedConversations, chatReady, displayName, staffUid, userId]);

  useEffect(() => {
    if (!chatReady || !staffUid) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      void claimWaitingConversation().catch(() => undefined);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [chatReady, staffUid]);

  async function refreshSummaryOnly() {
    try {
      const nextSummary = await getStaffDashboardSummary();
      setSummary(nextSummary);
    } catch {
      // ignore silent refresh errors
    }
  }

  async function handleUpdateOrder(
    orderId: string,
    payload: { order_status?: string; payment_status?: string },
  ) {
    try {
      const updated = await updateOrderStatus(orderId, payload);
      setOrders((current) =>
        current.map((item) => (item.id === orderId ? updated : item)),
      );
      toast.success("Đã cập nhật đơn hàng.");
      void refreshSummaryOnly();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không cập nhật được đơn hàng.",
      );
    }
  }

  function handleStartEditBook(book: ApiBook) {
    setEditingBookId(book.id);
    setQuickBookDrafts((current) => ({
      ...current,
      [book.id]: current[book.id] ?? {
        total_stock: String(book.total_stock ?? 0),
        description: book.description ?? "",
      },
    }));
  }

  function handleCancelEditBook() {
    setEditingBookId("");
  }

  async function handleQuickSaveBook(bookId: string) {
    if (!canManageInventory) {
      toast.info("Không thể cập nhật tồn kho hoặc mô tả lúc này.");
      return;
    }

    const draft = quickBookDrafts[bookId];
    if (!draft) return;

    try {
      const updated = await updateBookPartial(bookId, {
        total_stock: Number(draft.total_stock || 0),
        description: draft.description,
      });
      setBooks((current) =>
        current.map((item) => (item.id === bookId ? updated : item)),
      );
      toast.success("Đã lưu thay đổi sách.");
      setEditingBookId("");
      void refreshSummaryOnly();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không cập nhật được sách.",
      );
    }
  }

  async function handleSaveProfile() {
    if (!userId) return;

    try {
      const updated = await updateUser(userId, {
        full_name: profileDraft.full_name.trim(),
        email: profileDraft.email.trim(),
        phone: profileDraft.phone.trim(),
        address: profileDraft.address.trim(),
      });
      setMyProfile(updated);
      dispatch(
        setUser({
          id: updated.id,
          username: updated.username,
          email: updated.email,
          full_name: updated.full_name,
          phone: updated.phone,
        }),
      );
      toast.success("Đã cập nhật hồ sơ cá nhân.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không lưu được hồ sơ cá nhân.",
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
      toast.success("Đã đóng hội thoại.");
      await claimWaitingConversation().catch(() => undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không đóng được hội thoại.",
      );
    }
  }

  async function handleUpdateConversationLabels(nextLabels: string[]) {
    if (!selectedConversationId) return;
    const normalizedLabels = normalizeChatLabels(nextLabels);

    try {
      await setConversationLabels(selectedConversationId, normalizedLabels);
      setAssignedConversations((current) =>
        current.map((item) =>
          item.id === selectedConversationId
            ? { ...item, labels: normalizedLabels }
            : item,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không lưu được nhãn hội thoại.",
      );
    }
  }

  async function handleToggleSuggestedLabel(label: string) {
    if (!activeConversation) return;
    const currentLabels = normalizeChatLabels(activeConversation.labels);
    const nextLabels = currentLabels.includes(label)
      ? currentLabels.filter((item) => item !== label)
      : [...currentLabels, label];
    await handleUpdateConversationLabels(nextLabels);
  }

  async function handleAddCustomLabel() {
    if (!activeConversation) return;
    const value = customChatLabel.trim();
    if (!value) return;

    const nextLabels = normalizeChatLabels([
      ...(activeConversation.labels ?? []),
      value,
    ]);
    await handleUpdateConversationLabels(nextLabels);
    setCustomChatLabel("");
  }

  async function handleRemoveLabel(label: string) {
    if (!activeConversation) return;
    const nextLabels = normalizeChatLabels(
      (activeConversation.labels ?? []).filter((item) => item !== label),
    );
    await handleUpdateConversationLabels(nextLabels);
  }

  function handleSelectConversationGroup(group: ConversationGroup) {
    const activeInGroup =
      activeConversation &&
      getConversationCustomerKey(activeConversation) === group.customerKey
        ? activeConversation.id
        : "";
    setSelectedConversationId(activeInGroup || group.latestConversation.id);
  }

  async function handleLogout() {
    try {
      await signOutFirebaseUser().catch(() => undefined);
    } finally {
      clearAccessToken();
      navigate("/login", { replace: true });
      toast.success("Đã đăng xuất khỏi khu vực staff.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">
            Đang tải khu vực staff...
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Mình đang lấy sách, đơn hàng, chat và hồ sơ của bạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] xl:grid-cols-[280px,1fr]">
        <main className="xl:col-span-2 p-4 md:p-6 xl:p-8">
          <header className="sticky top-0 z-20 mb-6 rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
                    Staff Workspace
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">
                    Trang làm việc nhân viên
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Giao diện staff riêng cho các tác vụ vận hành nội bộ, tách
                    biệt hoàn toàn với khu mua hàng của khách.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-500">Role</p>
                    <p className="text-sm font-bold text-slate-900">
                      {primaryRole || "STAFF"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-500">Chat</p>
                    <p className="text-sm font-bold text-slate-900">
                      {chatReady
                        ? "Sẵn sàng"
                        : isBootstrappingChat
                          ? "Đang tải"
                          : "Chưa sẵn sàng"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-500">Hội thoại</p>
                    <p className="text-sm font-bold text-slate-900">
                      {assignedConversations.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("profile")}
                    className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hồ sơ staff
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {STAFF_MENU.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      activeSection === item.key
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p
                      className={`text-xs ${activeSection === item.key ? "text-emerald-50" : "text-slate-500"}`}
                    >
                      {item.note}
                    </p>
                  </button>
                ))}
              </div>
              {chatError ? (
                <p className="text-sm text-rose-600">Lỗi chat: {chatError}</p>
              ) : null}
            </div>
          </header>

          <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                  Dashboard nhân viên
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Quản lý công việc hằng ngày
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">
                  Theo dõi các đầu việc quan trọng trong ngày và chuyển nhanh
                  sang từng khu vực xử lý bên dưới.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[24rem]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Thể loại đang có</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {categories.length}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Hội thoại được giao</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {assignedConversations.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {activeSection === "overview" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
                  <SummaryCard
                    title="Đầu sách"
                    value={summary?.total_books ?? books.length}
                    note="Tổng số đầu sách hệ thống"
                  />
                  <SummaryCard
                    title="Đơn hàng"
                    value={summary?.total_orders ?? orders.length}
                    note="Tất cả đơn hàng"
                  />
                  <SummaryCard
                    title="Chờ duyệt"
                    value={summary?.pending_orders ?? 0}
                    note="Cần xử lý sớm"
                  />
                  <SummaryCard
                    title="Tin nhắn mới"
                    value={unreadConversationCount}
                    note="Hội thoại cần phản hồi"
                  />
                  <SummaryCard
                    title="Sắp hết hàng"
                    value={lowStockBooks.length}
                    note="Đầu sách cần bổ sung thêm"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                  <SectionCard
                    title="Đơn hàng cần chú ý"
                    note="Theo dõi nhanh các đơn mới và các đơn đang cần tiếp tục xử lý."
                    actions={
                      <button
                        type="button"
                        onClick={() => setActiveSection("orders")}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Xem đơn hàng
                      </button>
                    }
                  >
                    {recentOrders.length === 0 ? (
                      <EmptyState
                        title="Chưa có đơn hàng"
                        note="Khi có đơn mới, phần này sẽ hiển thị nhanh để staff theo dõi."
                      />
                    ) : (
                      <div className="space-y-3">
                        {recentOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-slate-900">
                                  Đơn #{order.id}
                                </p>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                  {order.order_status || "Chưa có trạng thái"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-500">
                                {order.shipping_address ||
                                  "Chưa có địa chỉ giao hàng"}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {formatDateTime(order.order_date)} •{" "}
                                {formatCurrency(order.total_amount)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSection("orders")}
                              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Mở chi tiết
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  <div className="space-y-6">
                    <SectionCard
                      title="Hội thoại cần phản hồi"
                      note="Hiển thị nhanh các cuộc trò chuyện staff đang phụ trách."
                      actions={
                        <button
                          type="button"
                          onClick={() => setActiveSection("chat")}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Mở chat hỗ trợ
                        </button>
                      }
                    >
                      {recentConversations.length === 0 ? (
                        <EmptyState
                          title="Chưa có hội thoại"
                          note="Khi khách hàng nhắn tin, phần này sẽ cập nhật để bạn theo dõi nhanh."
                        />
                      ) : (
                        <div className="space-y-3">
                          {recentConversations.map((group) => (
                            <div
                              key={group.customerKey}
                              className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {group.userName}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                                    {group.latestConversation.lastMessage ||
                                      "Chưa có nội dung mới"}
                                  </p>
                                </div>
                                {group.unreadCount > 0 ? (
                                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">
                                    {group.unreadCount} mới
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                                    Đã xem
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                                  {group.conversations.length} phiên chat
                                </span>
                                {group.labels.slice(0, 2).map((label) => (
                                  <span
                                    key={label}
                                    className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-slate-400">
                                Cập nhật:{" "}
                                {formatDateTime(
                                  group.latestConversation.updatedAt ||
                                    group.latestConversation.lastMessageAt,
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="Tồn kho cần kiểm tra"
                      note="Những đầu sách có số lượng thấp cần theo dõi hoặc nhập thêm."
                      actions={
                        <button
                          type="button"
                          onClick={() => setActiveSection("inventory")}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Xem tồn kho
                        </button>
                      }
                    >
                      {lowStockBooks.length === 0 ? (
                        <EmptyState
                          title="Tồn kho đang ổn"
                          note="Hiện chưa có đầu sách nào ở mức thấp."
                        />
                      ) : (
                        <div className="space-y-3">
                          {lowStockBooks.slice(0, 5).map((book) => (
                            <div
                              key={book.id}
                              className="flex items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {book.title}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {book.author_name || "Chưa có tác giả"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-500">
                                  Còn lại
                                </p>
                                <p className="text-lg font-bold text-amber-700">
                                  {book.total_stock ?? 0}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                </div>
              </>
            ) : null}

            {activeSection === "books" ? (
              <SectionCard
                title="Quản lý sách"
                note="Tìm kiếm, lọc nhanh theo thể loại/tồn kho. Mỗi sách hiển thị gọn; bấm Sửa mới mở form chỉnh thông tin."
                actions={
                  <div className="grid w-full gap-2 md:grid-cols-[minmax(240px,1fr),180px,180px] xl:w-auto">
                    <input
                      value={bookSearch}
                      onChange={(event) => setBookSearch(event.target.value)}
                      placeholder="Tìm tên sách, tác giả, mô tả..."
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-emerald-500"
                    />
                    <select
                      value={bookCategoryFilter}
                      onChange={(event) => setBookCategoryFilter(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-emerald-500"
                    >
                      <option value="all">Tất cả thể loại</option>
                      {bookCategoryOptions.map((categoryName) => (
                        <option key={categoryName} value={categoryName}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bookStockFilter}
                      onChange={(event) => setBookStockFilter(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-emerald-500"
                    >
                      <option value="all">Tất cả tồn kho</option>
                      <option value="available">Còn nhiều hàng</option>
                      <option value="low">Sắp hết hàng</option>
                      <option value="out">Hết hàng</option>
                    </select>
                  </div>
                }
              >
                <div className="mb-4 flex flex-col gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                  <span>
                    Đang hiển thị <strong className="text-slate-900">{filteredBooks.length}</strong> / {books.length} sách
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBookSearch("");
                      setBookCategoryFilter("all");
                      setBookStockFilter("all");
                    }}
                    className="self-start rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 md:self-auto"
                  >
                    Xóa bộ lọc
                  </button>
                </div>

                {filteredBooks.length === 0 ? (
                  <EmptyState
                    title="Chưa có sách phù hợp"
                    note="Thử đổi từ khóa tìm kiếm, thể loại hoặc bộ lọc tồn kho."
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredBooks.map((book) => {
                      const draft = quickBookDrafts[book.id] ?? {
                        total_stock: String(book.total_stock ?? 0),
                        description: book.description ?? "",
                      };
                      const stock = Number(book.total_stock ?? 0);
                      const isEditing = editingBookId === book.id;
                      const stockBadgeClass =
                        stock <= 0
                          ? "bg-rose-50 text-rose-700"
                          : stock <= 10
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700";
                      const stockLabel =
                        stock <= 0
                          ? "Hết hàng"
                          : stock <= 10
                            ? "Sắp hết"
                            : "Còn hàng";

                      return (
                        <article
                          key={book.id}
                          className={
                            "rounded-3xl border bg-white p-3 shadow-sm transition " +
                            (isEditing
                              ? "border-emerald-400 shadow-md"
                              : "border-slate-200")
                          }
                        >
                          <div className="flex gap-3">
                            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {book.cover_image ? (
                                <img
                                  src={book.cover_image}
                                  alt={book.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-400">
                                  Không ảnh
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                                    {book.title || "Chưa có tên sách"}
                                  </h3>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {book.author_name || "Chưa có tác giả"}
                                  </p>
                                </div>
                                <span
                                  className={
                                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold " +
                                    stockBadgeClass
                                  }
                                >
                                  {stockLabel}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  {book.category_name || "Chưa có thể loại"}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  Tồn: {book.total_stock ?? 0}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  Bán: {book.sold_count ?? 0}
                                </span>
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-slate-400">Giá bán</p>
                                  <p className="mt-0.5 font-bold text-slate-900">
                                    {formatCurrency(book.selling_price)}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-slate-400">Giá gốc</p>
                                  <p className="mt-0.5 font-semibold text-slate-700">
                                    {formatCurrency(book.original_price)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {!isEditing ? (
                            <div className="mt-3 border-t border-slate-100 pt-3">
                              <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">
                                {book.description || book.long_description || "Chưa có mô tả."}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleStartEditBook(book)}
                                className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Sửa thông tin
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-slate-900">
                                  Sửa sách đang chọn
                                </p>
                                <button
                                  type="button"
                                  onClick={handleCancelEditBook}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                >
                                  Đóng
                                </button>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Số lượng tồn kho
                                </label>
                                <input
                                  value={draft.total_stock}
                                  onChange={(event) =>
                                    setQuickBookDrafts((current) => ({
                                      ...current,
                                      [book.id]: {
                                        ...draft,
                                        total_stock: event.target.value,
                                      },
                                    }))
                                  }
                                  type="number"
                                  min="0"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Mô tả sách
                                </label>
                                <textarea
                                  value={draft.description}
                                  onChange={(event) =>
                                    setQuickBookDrafts((current) => ({
                                      ...current,
                                      [book.id]: {
                                        ...draft,
                                        description: event.target.value,
                                      },
                                    }))
                                  }
                                  rows={4}
                                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                                />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleQuickSaveBook(book.id)}
                                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditBook}
                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeSection === "orders" ? (
              <SectionCard
                title="Đơn hàng và chi tiết đơn hàng"
                note="Staff được cập nhật trạng thái cơ bản của đơn. Trạng thái thanh toán chỉ mở cho role nâng cao."
                actions={
                  <input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Tìm theo mã đơn, địa chỉ, tên sách..."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-emerald-500 md:w-80"
                  />
                }
              >
                {filteredOrders.length === 0 ? (
                  <EmptyState
                    title="Chưa có đơn hàng phù hợp"
                    note="Thử đổi từ khóa tìm kiếm hoặc tải lại dữ liệu."
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900">
                                Đơn #{order.id}
                              </h3>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                User #{order.user_id}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              Ngày tạo: {formatDateTime(order.order_date)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Địa chỉ giao: {order.shipping_address || "—"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Phương thức thanh toán:{" "}
                              {order.payment_method || "—"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Tổng tiền: {formatCurrency(order.total_amount)}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:w-[32rem]">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Trạng thái đơn hàng
                              </label>
                              <select
                                value={order.order_status}
                                onChange={(event) =>
                                  void handleUpdateOrder(order.id, {
                                    order_status: event.target.value,
                                  })
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                              >
                                {BASIC_ORDER_STATUS_OPTIONS.map((status) => (
                                  <option
                                    key={status.value}
                                    value={status.value}
                                  >
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Trạng thái thanh toán
                              </label>
                              <select
                                value={
                                  order.payment_status || "Chua thanh toan"
                                }
                                onChange={(event) => {
                                  if (!canManagePayments) {
                                    toast.info(
                                      "Không thể cập nhật trạng thái thanh toán lúc này.",
                                    );
                                    return;
                                  }
                                  void handleUpdateOrder(order.id, {
                                    payment_status: event.target.value,
                                  });
                                }}
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                              >
                                {ADVANCED_PAYMENT_STATUS_OPTIONS.map(
                                  (status) => (
                                    <option
                                      key={status.value}
                                      value={status.value}
                                    >
                                      {status.label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-left text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Sách</th>
                                <th className="px-4 py-3">Số lượng</th>
                                <th className="px-4 py-3">Đơn giá</th>
                                <th className="px-4 py-3">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {order.items.map((item) => (
                                <tr key={`${order.id}-${item.book_item_id}`}>
                                  <td className="px-4 py-3 font-medium text-slate-800">
                                    {item.title}
                                  </td>
                                  <td className="px-4 py-3">{item.quantity}</td>
                                  <td className="px-4 py-3">
                                    {formatCurrency(item.unit_price)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {formatCurrency(
                                      item.unit_price * item.quantity,
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeSection === "inventory" ? (
              <SectionCard
                title="Tồn kho"
                note="Theo dõi toàn bộ đầu sách, số lượng còn lại và cập nhật nhanh khi cần."
                actions={
                  <input
                    value={bookSearch}
                    onChange={(event) => setBookSearch(event.target.value)}
                    placeholder="Tìm theo tên sách, tác giả, thể loại..."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-emerald-500 md:w-80"
                  />
                }
              >
                {filteredBooks.length === 0 ? (
                  <EmptyState
                    title="Không có sách phù hợp"
                    note="Thử đổi từ khóa tìm kiếm hoặc tải lại dữ liệu."
                  />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {[...filteredBooks]
                      .sort(
                        (a, b) =>
                          Number(a.total_stock ?? 0) -
                          Number(b.total_stock ?? 0),
                      )
                      .map((book) => {
                        const draft = quickBookDrafts[book.id] ?? {
                          total_stock: String(book.total_stock ?? 0),
                          description: book.description ?? "",
                        };
                        const isLowStock = Number(book.total_stock ?? 0) <= 10;

                        return (
                          <div
                            key={book.id}
                            className={`rounded-3xl border p-4 ${
                              isLowStock
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-slate-900">
                                  {book.title}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                  {book.category_name || "Chưa có thể loại"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    isLowStock
                                      ? "bg-white text-amber-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  Còn {book.total_stock ?? 0}
                                </span>
                                <p className="mt-2 text-xs text-slate-400">
                                  Mã sách: {book.id}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 space-y-3">
                              <input
                                value={draft.total_stock}
                                onChange={(event) =>
                                  setQuickBookDrafts((current) => ({
                                    ...current,
                                    [book.id]: {
                                      ...draft,
                                      total_stock: event.target.value,
                                    },
                                  }))
                                }
                                className={`w-full rounded-2xl border bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 ${
                                  isLowStock
                                    ? "border-amber-200"
                                    : "border-slate-200"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void handleQuickSaveBook(book.id)
                                }
                                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                              >
                                Cập nhật tồn kho
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeSection === "chat" ? (
              <SectionCard
                title="Chat hỗ trợ trực tiếp"
                note="Tìm nhanh theo tên khách, gán nhãn để phân loại, lọc theo nhãn và xem toàn bộ lịch sử chat của cùng một khách hàng trong một cụm."
              >
                <div className="grid gap-4 xl:grid-cols-[380px,1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          Khách hàng đang hỗ trợ
                        </p>
                        <p className="text-sm text-slate-500">
                          {filteredConversationGroups.length} khách hàng •{" "}
                          {assignedConversations.length} phiên chat
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${chatReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                      >
                        {chatReady
                          ? "Đang nhận chat"
                          : isBootstrappingChat
                            ? "Đang khởi tạo"
                            : "Chưa sẵn sàng"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <input
                        value={chatSearch}
                        onChange={(event) => setChatSearch(event.target.value)}
                        placeholder="Tìm theo tên khách hàng hoặc nội dung chat..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                      />

                      <div className="overflow-x-auto pb-1">
                        <div className="flex min-w-max gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedChatLabel("all")}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selectedChatLabel === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                          >
                            Tất cả
                          </button>
                          {availableChatLabels.map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setSelectedChatLabel(label)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selectedChatLabel === label ? "bg-emerald-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {filteredConversationGroups.length === 0 ? (
                        <EmptyState
                          title="Không tìm thấy hội thoại phù hợp"
                          note="Thử đổi từ khóa hoặc bỏ bộ lọc nhãn để xem thêm kết quả."
                        />
                      ) : (
                        filteredConversationGroups.map((group) => {
                          const isActive =
                            activeConversationGroup?.customerKey ===
                            group.customerKey;
                          return (
                            <button
                              key={group.customerKey}
                              type="button"
                              onClick={() =>
                                handleSelectConversationGroup(group)
                              }
                              className={`block w-full rounded-3xl border px-4 py-3 text-left transition ${
                                isActive
                                  ? "border-emerald-400 bg-white shadow-sm"
                                  : "border-slate-200 bg-white hover:border-emerald-200"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {group.userName}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                    {group.latestConversation.lastMessage ||
                                      "Chưa có tin nhắn"}
                                  </p>
                                </div>
                                <div className="space-y-2 text-right">
                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                    {group.latestConversation.status}
                                  </span>
                                  {group.unreadCount > 0 ? (
                                    <div className="rounded-full bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white">
                                      {group.unreadCount} mới
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                  {group.conversations.length} phiên chat
                                </span>
                                {group.labels.slice(0, 3).map((label) => (
                                  <span
                                    key={label}
                                    className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-slate-400">
                                {formatDateTime(
                                  group.latestConversation.updatedAt ||
                                    group.latestConversation.lastMessageAt,
                                )}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex min-h-[38rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {activeConversationGroup?.userName ||
                              "Chọn một khách hàng"}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {activeConversation
                              ? `Đang mở phiên chat ${activeConversation.id.slice(0, 8)} • ${formatDateTime(activeConversation.updatedAt || activeConversation.lastMessageAt)}`
                              : "Chọn khách hàng ở cột bên trái để xem cuộc trò chuyện và lịch sử hỗ trợ."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCloseConversation()}
                          disabled={
                            !activeConversation ||
                            activeConversation.status === "CLOSED"
                          }
                          className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Đóng phiên chat đang mở
                        </button>
                      </div>

                      {activeConversation ? (
                        <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Nhãn hội thoại
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Gắn nhãn để lọc và phân loại nhanh các cuộc trò
                              chuyện.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {normalizeChatLabels(activeConversation.labels)
                              .length === 0 ? (
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                                Chưa gắn nhãn
                              </span>
                            ) : (
                              normalizeChatLabels(
                                activeConversation.labels,
                              ).map((label) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => void handleRemoveLabel(label)}
                                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
                                >
                                  {label} ×
                                </button>
                              ))
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {CHAT_LABEL_SUGGESTIONS.map((label) => {
                              const enabled = normalizeChatLabels(
                                activeConversation.labels,
                              ).includes(label);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() =>
                                    void handleToggleSuggestedLabel(label)
                                  }
                                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${enabled ? "bg-emerald-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={customChatLabel}
                              onChange={(event) =>
                                setCustomChatLabel(event.target.value)
                              }
                              placeholder="Thêm nhãn mới..."
                              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddCustomLabel()}
                              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Thêm nhãn
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {activeConversationGroup &&
                      activeConversationGroup.conversations.length > 0 ? (
                        <div className="mt-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Lịch sử chat của khách hàng này
                              </p>
                              <p className="text-xs text-slate-500">
                                Các phiên chat cũ được gom cùng một cụm để staff
                                dễ theo dõi.
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {activeConversationGroup.conversations.length}{" "}
                              phiên
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {activeConversationGroup.conversations.map(
                              (conversation) => {
                                const isCurrent =
                                  conversation.id === selectedConversationId;
                                return (
                                  <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedConversationId(conversation.id)
                                    }
                                    className={`rounded-3xl border px-4 py-3 text-left transition ${isCurrent ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                                        {conversation.status}
                                      </span>
                                      {Number(conversation.unreadByStaff ?? 0) >
                                      0 ? (
                                        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-600">
                                          {conversation.unreadByStaff} mới
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-3 text-sm font-semibold text-slate-900">
                                      Phiên chat #{conversation.id.slice(0, 8)}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                      {conversation.lastMessage ||
                                        "Chưa có nội dung mới"}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {normalizeChatLabels(conversation.labels)
                                        .slice(0, 2)
                                        .map((label) => (
                                          <span
                                            key={label}
                                            className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700"
                                          >
                                            {label}
                                          </span>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-400">
                                      {formatDateTime(
                                        conversation.updatedAt ||
                                          conversation.lastMessageAt,
                                      )}
                                    </p>
                                  </button>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
                      {!activeConversation ? (
                        <EmptyState
                          title="Chưa chọn cuộc trò chuyện"
                          note="Chọn một khách hàng ở cột bên trái để xem tin nhắn và lịch sử hỗ trợ."
                        />
                      ) : messages.length === 0 ? (
                        <p className="text-center text-sm text-slate-400">
                          Phiên chat này chưa có tin nhắn nào.
                        </p>
                      ) : null}

                      {messages.map((message) => {
                        const mine = message.senderRole === "STAFF";
                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${mine ? "bg-emerald-600 text-white" : "bg-white text-slate-700"}`}
                            >
                              {!mine && message.senderName ? (
                                <p className="mb-1 text-xs font-semibold text-emerald-700">
                                  {message.senderName}
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap text-sm leading-6">
                                {message.content}
                              </p>
                              <p
                                className={`mt-2 text-[11px] ${mine ? "text-emerald-50/80" : "text-slate-400"}`}
                              >
                                {formatDateTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 p-4">
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
                          className="min-h-[56px] flex-1 resize-none rounded-3xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSendChat()}
                          disabled={
                            !activeConversation ||
                            activeConversation.status === "CLOSED"
                          }
                          className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Gửi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeSection === "profile" ? (
              <SectionCard
                title="Thông tin cá nhân"
                note="Staff chỉ được xem và sửa hồ sơ của chính mình."
              >
                <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Họ và tên
                      </label>
                      <input
                        value={profileDraft.full_name}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            full_name: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Email
                      </label>
                      <input
                        value={profileDraft.email}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Số điện thoại
                      </label>
                      <input
                        value={profileDraft.phone}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Địa chỉ
                      </label>
                      <input
                        value={profileDraft.address}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Thông tin tài khoản
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-900">
                          ID:
                        </span>{" "}
                        {myProfile?.id || userId || "—"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Username:
                        </span>{" "}
                        {myProfile?.username || "—"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Role:
                        </span>{" "}
                        {primaryRole || "STAFF"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Điểm tích lũy:
                        </span>{" "}
                        {myProfile?.total_points ?? 0}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Trạng thái:
                        </span>{" "}
                        {myProfile?.status === 1 ? "Hoạt động" : "Không rõ"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSaveProfile()}
                      className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Lưu hồ sơ cá nhân
                    </button>
                  </div>
                </div>
              </SectionCard>
            ) : null}

          </div>
        </main>
      </div>
    </div>
  );
}
