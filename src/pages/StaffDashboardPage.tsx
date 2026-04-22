import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  MessageOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Tabs } from "antd";
import { toast } from "react-toastify";
import { useAppSelector } from "../app/hooks";
import { clearAccessToken } from "../services/axiosClient";
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
  markConversationReadForStaff,
  sendConversationMessage,
  updateConversationMetadata,
  upsertStaffStatus,
  type ChatConversation,
  type ChatMessage,
} from "../firebase/chatService";
import {
  claimWaitingConversation,
  closeSupportConversation,
} from "../services/supportService";

const STAFF_VIRTUAL_MAX_LOAD = 999999;
const ORDER_STATUSES = [
  "Cho duyet",
  "Dang xu ly",
  "Dang giao",
  "Da giao",
  "Thanh cong",
  "Da huy",
] as const;
const PAYMENT_STATUSES = [
  "Chua thanh toan",
  "Da thanh toan",
  "Dang hoan tien",
  "Da hoan tien",
  "That bai",
] as const;
const ORDER_SORT_OPTIONS = [
  { value: "LATEST", label: "Mới tạo gần nhất" },
  { value: "OLDEST", label: "Cũ nhất" },
  { value: "UPDATED", label: "Mới cập nhật" },
  { value: "TOTAL_DESC", label: "Tổng tiền giảm dần" },
  { value: "TOTAL_ASC", label: "Tổng tiền tăng dần" },
] as const;
const QUICK_CHAT_REPLIES = [
  "Em đã nhận được yêu cầu và đang kiểm tra cho anh/chị.",
  "Anh/chị vui lòng chờ em 1-2 phút để em kiểm tra đơn hàng nhé.",
  "Em đã cập nhật thông tin, anh/chị kiểm tra lại giúp em nhé.",
];
const CHAT_LABEL_OPTIONS = [
  "Đơn hàng",
  "Thanh toán",
  "Đổi trả",
  "Khiếu nại",
  "Tư vấn sách",
  "VIP",
  "Gấp",
];
const CHAT_PRIORITY_OPTIONS = [
  "ALL",
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
] as const;
const CHAT_SORT_OPTIONS = ["LATEST", "OLDEST", "UNREAD", "PRIORITY"] as const;

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDateTimeValue(value?: string): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toDateInputBoundary(value: string, type: "start" | "end"): number {
  if (!value) return 0;
  const suffix = type === "start" ? "T00:00:00" : "T23:59:59";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseMoneyInput(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function getPaymentStatusClasses(status?: string): string {
  const safeStatus = normalizeVietnameseText(status || "");
  if (safeStatus.includes("da thanh toan")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (safeStatus.includes("that bai")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (safeStatus.includes("hoan tien")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function toTimeValue(
  value?:
    | ChatConversation["updatedAt"]
    | ChatConversation["lastMessageAt"]
    | ChatMessage["createdAt"]
    | string,
) {
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return 0;
}

function normalizeVietnameseText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(
  values: Array<string | number | undefined>,
  query: string,
): boolean {
  const safeQuery = normalizeVietnameseText(query);
  if (!safeQuery) return true;
  return values.some((value) =>
    normalizeVietnameseText(String(value || "")).includes(safeQuery),
  );
}

function getOrderStatusClasses(status: string): string {
  const safeStatus = normalizeVietnameseText(status);
  if (safeStatus.includes("thanh cong")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (safeStatus == "da giao") {
    return "bg-teal-50 text-teal-700 border-teal-200";
  }
  if (safeStatus.includes("huy")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (safeStatus.includes("dang giao")) {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }
  if (safeStatus.includes("dang xu ly")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function getConversationStatusClasses(status: string): string {
  const safeStatus = String(status || "").toUpperCase();
  if (safeStatus === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (safeStatus === "WAITING") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (safeStatus === "CLOSED") {
    return "bg-gray-100 text-gray-600 border-gray-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getConversationPriorityClasses(priority?: string): string {
  const safePriority = String(priority || "NORMAL").toUpperCase();
  if (safePriority === "URGENT") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (safePriority === "HIGH") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }
  if (safePriority === "LOW") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function getConversationPriorityLabel(priority?: string): string {
  const safePriority = String(priority || "NORMAL").toUpperCase();
  if (safePriority === "URGENT") return "Khẩn cấp";
  if (safePriority === "HIGH") return "Cao";
  if (safePriority === "LOW") return "Thấp";
  return "Bình thường";
}

function getConversationPriorityRank(priority?: string): number {
  const safePriority = String(priority || "NORMAL").toUpperCase();
  if (safePriority === "URGENT") return 4;
  if (safePriority === "HIGH") return 3;
  if (safePriority === "NORMAL") return 2;
  return 1;
}

function getWaitingForLabel(waitingFor?: string): string {
  const safeValue = String(waitingFor || "").toUpperCase();
  if (safeValue === "STAFF") return "Cần staff phản hồi";
  if (safeValue === "USER") return "Đang chờ khách";
  return "Chưa xác định";
}

function sendDesktopNotification(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      tag,
      silent: false,
    });
    window.setTimeout(() => notification.close(), 6000);
  } catch {
    // no-op
  }
}

function SummaryCard({
  icon,
  title,
  value,
  note,
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-lg text-teal-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-400">{note}</p>
    </div>
  );
}

export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const displayName = useAppSelector((state) => state.session.displayName);
  const userId = useAppSelector((state) => state.session.userId);

  const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatConnectionState, setChatConnectionState] = useState<
    "connecting" | "ready" | "error"
  >("connecting");
  const [staffUid, setStaffUid] = useState("");
  const conversationMetaRef = useRef<
    Record<string, { unread: number; updatedAt: number }>
  >({});
  const hasHydratedConversationsRef = useRef(false);
  const [assignedConversations, setAssignedConversations] = useState<
    ChatConversation[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [bookDrafts, setBookDrafts] = useState<
    Record<
      string,
      {
        total_stock: string;
        description: string;
      }
    >
  >({});
  const [isBootstrappingChat, setIsBootstrappingChat] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] =
    useState("ALL");
  const [orderPaymentMethodFilter, setOrderPaymentMethodFilter] =
    useState("ALL");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderMinTotal, setOrderMinTotal] = useState("");
  const [orderMaxTotal, setOrderMaxTotal] = useState("");
  const [orderSort, setOrderSort] =
    useState<(typeof ORDER_SORT_OPTIONS)[number]["value"]>("LATEST");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderEditForm, setOrderEditForm] = useState({
    order_status: "Cho duyet",
    payment_status: "Chua thanh toan",
    payment_method: "",
    shipping_address: "",
  });
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [chatStatusFilter, setChatStatusFilter] = useState("ALL");
  const [chatPriorityFilter, setChatPriorityFilter] =
    useState<(typeof CHAT_PRIORITY_OPTIONS)[number]>("ALL");
  const [chatTagFilter, setChatTagFilter] = useState("ALL");
  const [chatSort, setChatSort] =
    useState<(typeof CHAT_SORT_OPTIONS)[number]>("LATEST");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getStaffDashboardSummary(),
      getOrdersForStaff(),
      getBooksForStaff(),
      getUsersForStaff(),
    ])
      .then(([summaryResponse, orderResponse, bookResponse, userResponse]) => {
        setSummary(summaryResponse);
        setOrders(orderResponse);
        setSelectedOrderId(orderResponse[0]?.id || "");
        setBooks(bookResponse);
        setUsers(userResponse);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu nhân viên.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!chatEnabled) {
      if (staffUid) {
        void upsertStaffStatus({
          staffUid,
          staffId: userId,
          staffName: displayName || "Nhân viên",
          acceptingChats: false,
          maxLoad: STAFF_VIRTUAL_MAX_LOAD,
        }).catch(() => undefined);
      }
      return;
    }

    let cancelled = false;
    setIsBootstrappingChat(true);
    setChatConnectionState("connecting");

    ensureFirebaseChatLogin()
      .then(async (uid) => {
        if (cancelled) return;
        setStaffUid(uid);
        await upsertStaffStatus({
          staffUid: uid,
          staffId: userId,
          staffName: displayName || "Nhân viên",
          acceptingChats: true,
          maxLoad: STAFF_VIRTUAL_MAX_LOAD,
        });
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "default"
        ) {
          void Notification.requestPermission().catch(() => undefined);
        }
        setChatConnectionState("ready");
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Không kết nối được Firebase chat.",
          );
          setChatEnabled(false);
          setChatConnectionState("error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrappingChat(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chatEnabled, displayName, userId]);

  useEffect(() => {
    if (!chatEnabled) return;

    let unsubscribe: undefined | (() => void);
    listenAssignedConversations((items) => {
      setAssignedConversations(items);
      setSelectedConversationId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current;
        }
        return items[0]?.id || "";
      });
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
        maxLoad: STAFF_VIRTUAL_MAX_LOAD,
      }).catch(() => undefined);
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 45000);

    return () => {
      window.clearInterval(timer);
    };
  }, [chatEnabled, displayName, staffUid, userId]);

  useEffect(() => {
    if (!chatEnabled || !selectedConversationId) {
      setMessages([]);
      return;
    }

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

    let cancelled = false;
    const runClaim = async () => {
      try {
        await claimWaitingConversation();
      } catch (error) {
        if (!cancelled && import.meta.env.DEV) {
          console.error(error);
        }
      }
    };

    void runClaim();
    const timer = window.setInterval(() => {
      void runClaim();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [assignedConversations.length, chatEnabled, staffUid]);

  const activeConversation = useMemo(
    () =>
      assignedConversations.find(
        (item) => item.id === selectedConversationId,
      ) ?? null,
    [assignedConversations, selectedConversationId],
  );

  useEffect(() => {
    setInternalNoteDraft(activeConversation?.internalNote ?? "");

    if (
      !activeConversation?.id ||
      !Number(activeConversation.unreadByStaff || 0)
    ) {
      return;
    }

    void markConversationReadForStaff(activeConversation.id).catch(
      () => undefined,
    );
  }, [activeConversation]);

  useEffect(() => {
    const currentMeta = Object.fromEntries(
      assignedConversations.map((conversation) => [
        conversation.id,
        {
          unread: Number(conversation.unreadByStaff || 0),
          updatedAt: toTimeValue(conversation.updatedAt),
        },
      ]),
    );

    if (!hasHydratedConversationsRef.current) {
      conversationMetaRef.current = currentMeta;
      hasHydratedConversationsRef.current = true;
      return;
    }

    assignedConversations.forEach((conversation) => {
      const previous = conversationMetaRef.current[conversation.id];
      const customerName =
        conversation.userName ||
        `Khách #${conversation.userId || conversation.id.slice(0, 6)}`;
      const currentUnread = Number(conversation.unreadByStaff || 0);
      const isSelected = selectedConversationId === conversation.id;
      const shouldSurfaceToast = !isSelected || document.hidden;

      if (!previous) {
        if (shouldSurfaceToast) {
          toast.info(`${customerName} vừa được kết nối tới bạn.`);
        }
        sendDesktopNotification(
          "Khách hàng mới cần hỗ trợ",
          `${customerName} vừa bắt đầu một cuộc trò chuyện mới.`,
          `conversation-${conversation.id}`,
        );
        return;
      }

      if (currentUnread > previous.unread && shouldSurfaceToast) {
        toast.info(`${customerName} vừa gửi tin nhắn mới.`);
        sendDesktopNotification(
          "Tin nhắn hỗ trợ mới",
          `${customerName}: ${conversation.lastMessage || "Có tin nhắn mới"}`,
          `message-${conversation.id}`,
        );
      }
    });

    conversationMetaRef.current = currentMeta;
  }, [assignedConversations, selectedConversationId]);

  const paymentMethodOptions = useMemo(
    () =>
      [
        ...new Set(orders.map((order) => order.payment_method).filter(Boolean)),
      ].sort((left, right) => String(left).localeCompare(String(right), "vi")),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const minTotal = parseMoneyInput(orderMinTotal);
    const maxTotal = parseMoneyInput(orderMaxTotal);
    const createdFrom = orderDateFrom
      ? toDateInputBoundary(orderDateFrom, "start")
      : 0;
    const createdTo = orderDateTo ? toDateInputBoundary(orderDateTo, "end") : 0;

    const items = orders.filter((order) => {
      const orderCreatedAt = getDateTimeValue(
        order.created_at || order.order_date,
      );
      const totalAmount = Number(order.total_amount || 0);
      const matchesStatus =
        orderStatusFilter === "ALL" || order.order_status === orderStatusFilter;
      const matchesPaymentStatus =
        orderPaymentStatusFilter === "ALL" ||
        String(order.payment_status || "") === orderPaymentStatusFilter;
      const matchesPaymentMethod =
        orderPaymentMethodFilter === "ALL" ||
        String(order.payment_method || "") === orderPaymentMethodFilter;
      const matchesDateFrom = !createdFrom || orderCreatedAt >= createdFrom;
      const matchesDateTo = !createdTo || orderCreatedAt <= createdTo;
      const matchesMinTotal = minTotal === null || totalAmount >= minTotal;
      const matchesMaxTotal = maxTotal === null || totalAmount <= maxTotal;
      const matchesSearchTerm = matchesQuery(
        [
          order.id,
          order.user_id,
          order.user_full_name,
          order.user_email,
          order.user_phone,
          order.shipping_address,
          order.payment_method,
          order.payment_status,
          order.order_status,
          order.promotion_code,
          ...order.items.map((item) => item.title),
        ],
        orderQuery,
      );

      return (
        matchesStatus &&
        matchesPaymentStatus &&
        matchesPaymentMethod &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesMinTotal &&
        matchesMaxTotal &&
        matchesSearchTerm
      );
    });

    return [...items].sort((left, right) => {
      if (orderSort === "TOTAL_DESC") {
        return Number(right.total_amount || 0) - Number(left.total_amount || 0);
      }
      if (orderSort === "TOTAL_ASC") {
        return Number(left.total_amount || 0) - Number(right.total_amount || 0);
      }
      if (orderSort === "UPDATED") {
        return (
          getDateTimeValue(right.updated_at) - getDateTimeValue(left.updated_at)
        );
      }
      if (orderSort === "OLDEST") {
        return (
          getDateTimeValue(left.order_date) - getDateTimeValue(right.order_date)
        );
      }
      return (
        getDateTimeValue(right.order_date) - getDateTimeValue(left.order_date)
      );
    });
  }, [
    orderDateFrom,
    orderDateTo,
    orderMaxTotal,
    orderMinTotal,
    orderPaymentMethodFilter,
    orderPaymentStatusFilter,
    orderQuery,
    orderSort,
    orderStatusFilter,
    orders,
  ]);

  const activeOrder = useMemo(
    () =>
      filteredOrders.find((order) => order.id === selectedOrderId) ??
      filteredOrders[0] ??
      null,
    [filteredOrders, selectedOrderId],
  );

  const orderMetrics = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.totalAmount += Number(order.total_amount || 0);
        acc.totalDiscount += Number(order.total_discount_amount || 0);
        acc.totalItems += Number(
          order.total_items ||
            order.items.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0,
            ),
        );
        if (order.order_status === "Cho duyet") acc.pending += 1;
        if (order.order_status === "Dang giao") acc.shipping += 1;
        if (order.order_status === "Thanh cong") acc.success += 1;
        if (order.order_status === "Da huy") acc.cancelled += 1;
        return acc;
      },
      {
        totalAmount: 0,
        totalDiscount: 0,
        totalItems: 0,
        pending: 0,
        shipping: 0,
        success: 0,
        cancelled: 0,
      },
    );
  }, [filteredOrders]);

  const filteredBooks = useMemo(() => {
    return books
      .filter((book) =>
        matchesQuery(
          [book.title, book.author_name, book.category_name, book.description],
          bookQuery,
        ),
      )
      .sort((left, right) => {
        const leftStock = Number(left.total_stock ?? 0);
        const rightStock = Number(right.total_stock ?? 0);
        if (leftStock !== rightStock) return leftStock - rightStock;
        return left.title.localeCompare(right.title, "vi");
      });
  }, [bookQuery, books]);

  const customerUsers = useMemo(() => {
    const hasRoleInformation = users.some(
      (user) => typeof user.role_id === "number" && !Number.isNaN(user.role_id),
    );
    const base = hasRoleInformation
      ? users.filter((user) => Number(user.role_id) === 3)
      : users;

    return base.filter((user) =>
      matchesQuery(
        [user.full_name, user.username, user.email, user.phone, user.id],
        customerQuery,
      ),
    );
  }, [customerQuery, users]);

  const activeChatCount = useMemo(
    () =>
      assignedConversations.filter((item) => item.status === "ACTIVE").length,
    [assignedConversations],
  );

  const filteredConversations = useMemo(() => {
    const items = assignedConversations.filter((conversation) => {
      const matchesStatus =
        chatStatusFilter === "ALL" || conversation.status === chatStatusFilter;
      const matchesPriority =
        chatPriorityFilter === "ALL" ||
        String(conversation.priority || "NORMAL").toUpperCase() ===
          chatPriorityFilter;
      const matchesTag =
        chatTagFilter === "ALL" ||
        (conversation.tags ?? []).some((tag) => tag === chatTagFilter);
      const matchesUnread =
        !showUnreadOnly || Number(conversation.unreadByStaff || 0) > 0;
      const matchesPinned =
        !showPinnedOnly || Boolean(conversation.pinnedByStaff);
      const matchesSearchTerm = matchesQuery(
        [
          conversation.userName,
          conversation.userId,
          conversation.lastMessage,
          conversation.staffName ?? undefined,
          ...(conversation.tags ?? []),
          conversation.internalNote,
          getWaitingForLabel(conversation.waitingFor),
        ],
        chatQuery,
      );
      return (
        matchesStatus &&
        matchesPriority &&
        matchesTag &&
        matchesUnread &&
        matchesPinned &&
        matchesSearchTerm
      );
    });

    return [...items].sort((left, right) => {
      if (chatSort === "UNREAD") {
        const unreadDiff =
          Number(right.unreadByStaff || 0) - Number(left.unreadByStaff || 0);
        if (unreadDiff !== 0) return unreadDiff;
      }
      if (chatSort === "PRIORITY") {
        const priorityDiff =
          getConversationPriorityRank(right.priority) -
          getConversationPriorityRank(left.priority);
        if (priorityDiff !== 0) return priorityDiff;
      }
      if (Boolean(right.pinnedByStaff) !== Boolean(left.pinnedByStaff)) {
        return (
          Number(Boolean(right.pinnedByStaff)) -
          Number(Boolean(left.pinnedByStaff))
        );
      }
      const effectiveDiff =
        toTimeValue(right.updatedAt) - toTimeValue(left.updatedAt);
      if (chatSort === "OLDEST") {
        return -effectiveDiff;
      }
      return effectiveDiff;
    });
  }, [
    assignedConversations,
    chatPriorityFilter,
    chatQuery,
    chatSort,
    chatStatusFilter,
    chatTagFilter,
    showPinnedOnly,
    showUnreadOnly,
  ]);

  const unreadConversationCount = useMemo(
    () =>
      assignedConversations.filter(
        (item) => Number(item.unreadByStaff || 0) > 0,
      ).length,
    [assignedConversations],
  );

  const pinnedConversationCount = useMemo(
    () =>
      assignedConversations.filter((item) => Boolean(item.pinnedByStaff))
        .length,
    [assignedConversations],
  );

  const waitingChatCount = useMemo(
    () =>
      assignedConversations.filter((item) => item.status === "WAITING").length,
    [assignedConversations],
  );

  const lowStockBooks = useMemo(
    () => books.filter((book) => Number(book.total_stock ?? 0) <= 5).length,
    [books],
  );

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId("");
      return;
    }
    if (
      !selectedOrderId ||
      !filteredOrders.some((order) => order.id === selectedOrderId)
    ) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (!activeOrder) return;
    setOrderEditForm({
      order_status: activeOrder.order_status || "Cho duyet",
      payment_status: activeOrder.payment_status || "Chua thanh toan",
      payment_method: activeOrder.payment_method || "",
      shipping_address: activeOrder.shipping_address || "",
    });
  }, [activeOrder]);

  async function reloadOrders() {
    setIsRefreshingOrders(true);
    try {
      const response = await getOrdersForStaff();
      setOrders(response);
      toast.success("Đã tải lại danh sách đơn hàng.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tải lại được đơn hàng.",
      );
    } finally {
      setIsRefreshingOrders(false);
    }
  }

  function resetOrderFilters() {
    setOrderQuery("");
    setOrderStatusFilter("ALL");
    setOrderPaymentStatusFilter("ALL");
    setOrderPaymentMethodFilter("ALL");
    setOrderDateFrom("");
    setOrderDateTo("");
    setOrderMinTotal("");
    setOrderMaxTotal("");
    setOrderSort("LATEST");
  }

  async function handleSaveOrderChanges() {
    if (!activeOrder) return;
    setIsSavingOrder(true);
    try {
      const updated = await updateOrderStatus(activeOrder.id, {
        order_status: orderEditForm.order_status,
        payment_status: orderEditForm.payment_status,
        payment_method: orderEditForm.payment_method.trim(),
        shipping_address: orderEditForm.shipping_address.trim(),
      });
      setOrders((current) =>
        current.map((item) => (item.id === activeOrder.id ? updated : item)),
      );
      toast.success("Đã lưu cập nhật đơn hàng.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không lưu được đơn hàng.",
      );
    } finally {
      setIsSavingOrder(false);
    }
  }

  async function handleSaveBook(bookId: string) {
    const draft = bookDrafts[bookId];
    if (!draft) return;

    const nextStock = Number(draft.total_stock || 0);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      toast.info("Tồn kho phải là số lớn hơn hoặc bằng 0.");
      return;
    }

    try {
      const updated = await updateBookPartial(bookId, {
        total_stock: nextStock,
        description: draft.description,
      });
      setBooks((current) =>
        current.map((item) => (item.id === bookId ? updated : item)),
      );
      setBookDrafts((current) => ({
        ...current,
        [bookId]: {
          total_stock: String(updated.total_stock ?? 0),
          description: updated.description ?? "",
        },
      }));
      toast.success("Đã cập nhật thông tin sách.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không cập nhật được sách.",
      );
    }
  }

  function updateBookDraft(
    bookId: string,
    updater: (draft: { total_stock: string; description: string }) => {
      total_stock: string;
      description: string;
    },
  ) {
    setBookDrafts((current) => {
      const sourceBook = books.find((item) => item.id === bookId);
      const baseDraft = current[bookId] ?? {
        total_stock: String(sourceBook?.total_stock ?? 0),
        description: sourceBook?.description ?? "",
      };
      return {
        ...current,
        [bookId]: updater(baseDraft),
      };
    });
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

  async function handleToggleConversationTag(tag: string) {
    if (!activeConversation) return;
    const currentTags = activeConversation.tags ?? [];
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag];

    try {
      await updateConversationMetadata(activeConversation.id, {
        tags: nextTags,
      });
      toast.success("Đã cập nhật nhãn hội thoại.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không cập nhật được nhãn hội thoại.",
      );
    }
  }

  async function handleSetConversationPriority(priority: string) {
    if (!activeConversation) return;

    try {
      await updateConversationMetadata(activeConversation.id, { priority });
      toast.success("Đã cập nhật mức ưu tiên.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không cập nhật được mức ưu tiên.",
      );
    }
  }

  async function handleToggleConversationPinned() {
    if (!activeConversation) return;

    try {
      await updateConversationMetadata(activeConversation.id, {
        pinnedByStaff: !activeConversation.pinnedByStaff,
      });
      toast.success(
        activeConversation.pinnedByStaff
          ? "Đã bỏ ghim hội thoại."
          : "Đã ghim hội thoại lên đầu danh sách.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không cập nhật được trạng thái ghim.",
      );
    }
  }

  async function handleSaveInternalNote() {
    if (!activeConversation) return;

    try {
      await updateConversationMetadata(activeConversation.id, {
        internalNote: internalNoteDraft.trim(),
      });
      toast.success("Đã lưu ghi chú nội bộ.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không lưu được ghi chú nội bộ.",
      );
    }
  }

  const handleLogout = () => {
    clearAccessToken();
    toast.success("Đã đăng xuất tài khoản staff");
    navigate("/login", { replace: true });
  };

  const items = [
    {
      key: "overview",
      label: "Tổng quan",
      children: (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-700 p-6 text-white shadow-lg xl:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-100/80">
                Dashboard staff
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight">
                Xin chào {displayName || "nhân viên"}, hôm nay bạn có thể xử lý
                đơn, kiểm soát tồn kho và hỗ trợ khách hàng từ một nơi duy nhất.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-teal-50/75">
                    Đơn đang xem
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {filteredOrders.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-teal-50/75">
                    Hội thoại đang xử lý
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {activeChatCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-wide text-teal-50/75">
                    Tồn kho thấp
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{lowStockBooks}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
              <p className="text-sm font-semibold text-amber-800">
                Cần ưu tiên hôm nay
              </p>
              <ul className="mt-4 space-y-3 text-sm text-amber-900">
                <li className="rounded-2xl bg-white/80 px-4 py-3">
                  {summary?.pending_orders ?? 0} đơn hàng đang chờ staff xác
                  nhận.
                </li>
                <li className="rounded-2xl bg-white/80 px-4 py-3">
                  {lowStockBooks} đầu sách sắp hết hàng cần theo dõi tồn kho.
                </li>
                <li className="rounded-2xl bg-white/80 px-4 py-3">
                  {activeChatCount + waitingChatCount} hội thoại đang được hệ
                  thống gán hoặc chờ xử lý.
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              icon={<BookOutlined />}
              title="Đầu sách"
              value={summary?.total_books ?? 0}
              note="Tổng số đầu sách đang quản lý"
            />
            <SummaryCard
              icon={<ShoppingCartOutlined />}
              title="Đơn hàng"
              value={summary?.total_orders ?? 0}
              note="Tất cả đơn hàng trong hệ thống"
            />
            <SummaryCard
              icon={<ClockCircleOutlined />}
              title="Chờ duyệt"
              value={summary?.pending_orders ?? 0}
              note="Những đơn cần xác nhận ngay"
            />
            <SummaryCard
              icon={<CheckCircleOutlined />}
              title="Đang giao"
              value={summary?.shipping_orders ?? 0}
              note="Đơn đang trong quá trình vận chuyển"
            />
            <SummaryCard
              icon={<TeamOutlined />}
              title="Khách hàng"
              value={summary?.total_customers ?? customerUsers.length}
              note="Số tài khoản khách hàng đang hoạt động"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className="rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-teal-700">
                Đi tới đơn hàng
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                Cập nhật trạng thái và theo dõi tiến độ giao hàng
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Tổng doanh thu tạm tính theo bộ lọc hiện tại:{" "}
                {formatCurrency(orderMetrics.totalAmount)}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("books")}
              className="rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-teal-700">
                Đi tới kho sách
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                Cập nhật tồn kho và mô tả ngắn cho từng đầu sách
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Có {lowStockBooks} sách đang ở mức tồn kho thấp.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className="rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-teal-700">
                Đi tới hỗ trợ chat
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                Bật nhận chat và phản hồi khách hàng realtime
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Đang phụ trách {activeChatCount} hội thoại hoạt động và{" "}
                {waitingChatCount} hội thoại đang chờ theo dõi.
              </p>
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "orders",
      label: `Đơn hàng (${filteredOrders.length})`,
      children: (
        <div className="space-y-5">
          <div className="grid gap-3 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Đơn theo bộ lọc</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {filteredOrders.length}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {orderMetrics.pending} chờ duyệt • {orderMetrics.shipping} đang
                giao
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Giá trị đơn hàng</p>
              <p className="mt-2 text-2xl font-bold text-teal-800">
                {formatCurrency(orderMetrics.totalAmount)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Sau giảm giá theo bộ lọc hiện tại
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Tổng giảm giá</p>
              <p className="mt-2 text-2xl font-bold text-violet-700">
                {formatCurrency(orderMetrics.totalDiscount)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Gồm voucher và đổi điểm
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Sản phẩm đã bán</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {orderMetrics.totalItems}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {orderMetrics.success} đơn thành công • {orderMetrics.cancelled}{" "}
                đã hủy
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[1.6fr,1fr,1fr,1fr]">
              <input
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                placeholder="Tìm theo mã đơn, tên khách, SĐT, email, mã giảm giá, địa chỉ, tên sách..."
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              />
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              >
                <option value="ALL">Tất cả trạng thái đơn</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={orderPaymentStatusFilter}
                onChange={(event) =>
                  setOrderPaymentStatusFilter(event.target.value)
                }
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              >
                <option value="ALL">Tất cả trạng thái thanh toán</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={orderPaymentMethodFilter}
                onChange={(event) =>
                  setOrderPaymentMethodFilter(event.target.value)
                }
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              >
                <option value="ALL">Tất cả phương thức thanh toán</option>
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr,1fr,0.8fr,0.8fr,1fr,auto,auto]">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Từ ngày tạo
                <input
                  type="date"
                  value={orderDateFrom}
                  onChange={(event) => setOrderDateFrom(event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Đến ngày tạo
                <input
                  type="date"
                  value={orderDateTo}
                  onChange={(event) => setOrderDateTo(event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                />
              </label>
              <input
                value={orderMinTotal}
                onChange={(event) => setOrderMinTotal(event.target.value)}
                placeholder="Tổng tiền từ"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              />
              <input
                value={orderMaxTotal}
                onChange={(event) => setOrderMaxTotal(event.target.value)}
                placeholder="Tổng tiền đến"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              />
              <select
                value={orderSort}
                onChange={(event) =>
                  setOrderSort(
                    event.target
                      .value as (typeof ORDER_SORT_OPTIONS)[number]["value"],
                  )
                }
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
              >
                {ORDER_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetOrderFilters}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-teal-200 hover:text-teal-700"
              >
                Xóa lọc
              </button>
              <button
                type="button"
                onClick={() => void reloadOrders()}
                disabled={isRefreshingOrders}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRefreshingOrders ? "Đang tải..." : "Tải lại"}
              </button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[24rem,1fr]">
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-400">
                  Không có đơn hàng phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = activeOrder?.id === order.id;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`block w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                        isSelected
                          ? "border-teal-700 bg-teal-50"
                          : "border-gray-200 bg-white hover:border-teal-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">
                              Đơn #{order.id}
                            </p>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusClasses(order.order_status)}`}
                            >
                              {order.order_status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {order.user_full_name || `Khách #${order.user_id}`}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatOrderDate(order.order_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-teal-800">
                            {formatCurrency(order.total_amount)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentStatusClasses(order.payment_status)}`}
                          >
                            {order.payment_status || "Chua thanh toan"}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-gray-500">
                        {order.shipping_address || "Chưa có địa chỉ giao hàng"}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {order.total_items || order.items.length} sản phẩm
                        </span>
                        <span>
                          {order.payment_method || "Chưa có phương thức"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
              {!activeOrder ? (
                <div className="rounded-3xl border border-dashed border-gray-300 px-6 py-14 text-center text-sm text-gray-400">
                  Chọn một đơn hàng để xem chi tiết và chỉnh sửa.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-bold text-slate-900">
                          Đơn #{activeOrder.id}
                        </h3>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(activeOrder.order_status)}`}
                        >
                          {activeOrder.order_status}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusClasses(activeOrder.payment_status)}`}
                        >
                          {activeOrder.payment_status || "Chua thanh toan"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        Tạo lúc{" "}
                        {formatOrderDate(
                          activeOrder.created_at || activeOrder.order_date,
                        )}{" "}
                        • Cập nhật lần cuối{" "}
                        {formatOrderDate(
                          activeOrder.updated_at || activeOrder.order_date,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Mã giảm giá:{" "}
                        {activeOrder.promotion_code || "Không áp dụng"}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
                      <p className="text-xs uppercase tracking-wide text-white/70">
                        Khách phải trả
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {formatCurrency(activeOrder.total_amount)}
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        Tổng giảm{" "}
                        {formatCurrency(activeOrder.total_discount_amount || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          Thông tin khách hàng
                        </h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-gray-400">Khách hàng</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {activeOrder.user_full_name ||
                                `Khách #${activeOrder.user_id}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Mã user</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              #{activeOrder.user_id}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Email</p>
                            <p className="mt-1 text-slate-700">
                              {activeOrder.user_email || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">
                              Số điện thoại
                            </p>
                            <p className="mt-1 text-slate-700">
                              {activeOrder.user_phone || "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          Cập nhật đơn hàng
                        </h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Trạng thái đơn
                            <select
                              value={orderEditForm.order_status}
                              onChange={(event) =>
                                setOrderEditForm((current) => ({
                                  ...current,
                                  order_status: event.target.value,
                                }))
                              }
                              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                            >
                              {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Trạng thái thanh toán
                            <select
                              value={orderEditForm.payment_status}
                              onChange={(event) =>
                                setOrderEditForm((current) => ({
                                  ...current,
                                  payment_status: event.target.value,
                                }))
                              }
                              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                            >
                              {PAYMENT_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3">
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Phương thức thanh toán
                            <input
                              value={orderEditForm.payment_method}
                              onChange={(event) =>
                                setOrderEditForm((current) => ({
                                  ...current,
                                  payment_method: event.target.value,
                                }))
                              }
                              placeholder="VD: COD, VNPAY, Chuyển khoản"
                              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Địa chỉ giao hàng
                            <textarea
                              rows={3}
                              value={orderEditForm.shipping_address}
                              onChange={(event) =>
                                setOrderEditForm((current) => ({
                                  ...current,
                                  shipping_address: event.target.value,
                                }))
                              }
                              placeholder="Cập nhật địa chỉ giao hàng..."
                              className="resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-600"
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {ORDER_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                setOrderEditForm((current) => ({
                                  ...current,
                                  order_status: status,
                                }))
                              }
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                orderEditForm.order_status === status
                                  ? "border-teal-200 bg-teal-50 text-teal-700"
                                  : "border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleSaveOrderChanges()}
                            disabled={isSavingOrder}
                            className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingOrder ? "Đang lưu..." : "Lưu cập nhật đơn"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              activeOrder &&
                              setOrderEditForm({
                                order_status:
                                  activeOrder.order_status || "Cho duyet",
                                payment_status:
                                  activeOrder.payment_status ||
                                  "Chua thanh toan",
                                payment_method:
                                  activeOrder.payment_method || "",
                                shipping_address:
                                  activeOrder.shipping_address || "",
                              })
                            }
                            className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-teal-200 hover:text-teal-700"
                          >
                            Hoàn tác thay đổi
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          Tài chính đơn hàng
                        </h4>
                        <div className="mt-3 space-y-3 text-sm text-gray-600">
                          <div className="flex items-center justify-between">
                            <span>Tạm tính</span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(
                                activeOrder.subtotal_amount ||
                                  activeOrder.total_amount,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Giảm giá voucher</span>
                            <span className="font-semibold text-violet-700">
                              -
                              {formatCurrency(
                                activeOrder.promotion_discount_amount || 0,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Giảm từ điểm</span>
                            <span className="font-semibold text-violet-700">
                              -
                              {formatCurrency(
                                activeOrder.point_discount_amount || 0,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Điểm đã dùng</span>
                            <span className="font-semibold text-slate-900">
                              {activeOrder.points_used || 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                            <span className="font-semibold text-slate-900">
                              Tổng thanh toán
                            </span>
                            <span className="text-lg font-bold text-teal-800">
                              {formatCurrency(activeOrder.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          Ghi chú / trạng thái hệ thống
                        </h4>
                        <div className="mt-3 space-y-2 text-sm text-gray-600">
                          <p>
                            Trường{" "}
                            <span className="font-semibold text-slate-900">
                              ghi chú đơn hàng
                            </span>{" "}
                            hiện chưa có trong bảng
                            <span className="font-semibold text-slate-900">
                              {" "}
                              orders{" "}
                            </span>
                            của schema hiện tại, nên phần này mới ở mức hiển thị
                            thông báo thay vì lưu xuống DB.
                          </p>
                          <p>
                            Cập nhật trạng thái gần nhất:{" "}
                            <span className="font-semibold text-slate-900">
                              {formatOrderDate(
                                activeOrder.updated_at ||
                                  activeOrder.order_date,
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-gray-200">
                    <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Chi tiết sản phẩm trong đơn
                      </h4>
                    </div>
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead className="bg-white text-left text-gray-500">
                        <tr>
                          <th className="px-5 py-3">Sản phẩm</th>
                          <th className="px-5 py-3">Số lượng</th>
                          <th className="px-5 py-3">Đơn giá</th>
                          <th className="px-5 py-3">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {activeOrder.items.map((item) => (
                          <tr
                            key={`${activeOrder.id}-${item.book_item_id}-${item.title}`}
                          >
                            <td className="px-5 py-4 font-medium text-slate-800">
                              {item.title}
                            </td>
                            <td className="px-5 py-4 text-gray-600">
                              × {item.quantity}
                            </td>
                            <td className="px-5 py-4 text-gray-600">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-900">
                              {formatCurrency(
                                Number(item.quantity || 0) *
                                  Number(item.unit_price || 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "books",
      label: `Sách (${filteredBooks.length})`,
      children: (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr,auto]">
            <input
              value={bookQuery}
              onChange={(event) => setBookQuery(event.target.value)}
              placeholder="Tìm theo tên sách, tác giả, danh mục hoặc mô tả..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
            />
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              Sắp xếp ưu tiên sách tồn kho thấp
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredBooks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-400 xl:col-span-2">
                Không có đầu sách phù hợp.
              </div>
            ) : (
              filteredBooks.map((book) => {
                const draft = bookDrafts[book.id] ?? {
                  total_stock: String(book.total_stock ?? 0),
                  description: book.description ?? "",
                };
                const currentStock = Number(draft.total_stock || 0);
                const isLowStock = currentStock <= 5;

                return (
                  <div
                    key={book.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="grid gap-4 lg:grid-cols-[8.5rem,1fr]">
                      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                        <img
                          src={
                            book.cover_image ||
                            "https://placehold.co/320x460?text=Book"
                          }
                          alt={book.title}
                          className="h-44 w-full object-cover"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-slate-900">
                                {book.title}
                              </p>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                  isLowStock
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {isLowStock ? "Tồn kho thấp" : "Ổn định"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {book.author_name || "Chưa có tác giả"} •{" "}
                              {book.category_name || "Chưa phân loại"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-teal-800">
                              {formatCurrency(book.selling_price)}
                            </p>
                            <p className="text-xs text-gray-400">
                              Đã bán {book.sold_count} • Thuê{" "}
                              {book.rental_count}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Tồn kho
                            </label>
                            <div className="flex gap-2">
                              <input
                                value={draft.total_stock}
                                onChange={(event) =>
                                  updateBookDraft(book.id, (current) => ({
                                    ...current,
                                    total_stock: event.target.value,
                                  }))
                                }
                                className="w-full rounded-2xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateBookDraft(book.id, (current) => ({
                                    ...current,
                                    total_stock: String(
                                      Math.max(
                                        0,
                                        Number(current.total_stock || 0) + 5,
                                      ),
                                    ),
                                  }))
                                }
                                className="rounded-2xl border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition hover:border-teal-200 hover:text-teal-700"
                              >
                                +5
                              </button>
                            </div>
                          </div>

                          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center justify-between">
                              <span>Tồn kho hiện tại</span>
                              <span className="font-semibold text-slate-900">
                                {currentStock}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span>Danh mục</span>
                              <span className="font-medium text-slate-700">
                                {book.category_name || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Mô tả ngắn
                          </label>
                          <textarea
                            value={draft.description}
                            onChange={(event) =>
                              updateBookDraft(book.id, (current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleSaveBook(book.id)}
                            className="rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                          >
                            Lưu thay đổi
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateBookDraft(book.id, () => ({
                                total_stock: String(book.total_stock ?? 0),
                                description: book.description ?? "",
                              }))
                            }
                            className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            Hoàn tác
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ),
    },
    {
      key: "customers",
      label: `Khách hàng (${customerUsers.length})`,
      children: (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr,auto]">
            <input
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Tìm theo tên, username, email, số điện thoại hoặc ID..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600"
            />
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              Hiển thị danh sách khách hàng để staff hỗ trợ nhanh
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Họ tên</th>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Điện thoại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      Không tìm thấy khách hàng phù hợp.
                    </td>
                  </tr>
                ) : (
                  customerUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-teal-900">
                        #{user.id}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {user.username || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {user.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {user.phone || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      key: "chat",
      label: `Chat hỗ trợ (${assignedConversations.length})`,
      children: (
        <div className="grid gap-4 xl:grid-cols-[22rem,1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    Trạng thái hỗ trợ
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Staff đăng nhập là tự động sẵn sàng nhận chat, không cần bật
                    thủ công.
                  </p>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    chatConnectionState === "ready"
                      ? "bg-emerald-100 text-emerald-700"
                      : chatConnectionState === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isBootstrappingChat
                    ? "Đang kết nối..."
                    : chatConnectionState === "ready"
                      ? "Sẵn sàng"
                      : "Lỗi kết nối"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <div className="font-semibold">Active</div>
                  <div className="mt-1 text-2xl font-bold">
                    {activeChatCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-semibold">Chờ xử lý</div>
                  <div className="mt-1 text-2xl font-bold">
                    {waitingChatCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <div className="font-semibold">Chưa đọc</div>
                  <div className="mt-1 text-2xl font-bold">
                    {unreadConversationCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  <div className="font-semibold">Đã ghim</div>
                  <div className="mt-1 text-2xl font-bold">
                    {pinnedConversationCount}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-400">
                Staff đăng nhập là tự động ở trạng thái sẵn sàng và hệ thống sẽ
                chia hội thoại theo tải hiện tại.
              </p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-slate-900">
                Quản lý danh sách chat
              </p>
              <div className="mt-4 space-y-3">
                <input
                  value={chatQuery}
                  onChange={(event) => setChatQuery(event.target.value)}
                  placeholder="Tìm theo khách hàng, nội dung, nhãn, ghi chú..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={chatStatusFilter}
                    onChange={(event) =>
                      setChatStatusFilter(event.target.value)
                    }
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang xử lý</option>
                    <option value="WAITING">Đang chờ</option>
                    <option value="CLOSED">Đã đóng</option>
                  </select>
                  <select
                    value={chatPriorityFilter}
                    onChange={(event) =>
                      setChatPriorityFilter(
                        event.target
                          .value as (typeof CHAT_PRIORITY_OPTIONS)[number],
                      )
                    }
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600"
                  >
                    <option value="ALL">Mọi ưu tiên</option>
                    <option value="LOW">Ưu tiên thấp</option>
                    <option value="NORMAL">Ưu tiên bình thường</option>
                    <option value="HIGH">Ưu tiên cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                  <select
                    value={chatTagFilter}
                    onChange={(event) => setChatTagFilter(event.target.value)}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600"
                  >
                    <option value="ALL">Tất cả nhãn</option>
                    {CHAT_LABEL_OPTIONS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <select
                    value={chatSort}
                    onChange={(event) =>
                      setChatSort(
                        event.target
                          .value as (typeof CHAT_SORT_OPTIONS)[number],
                      )
                    }
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600"
                  >
                    <option value="LATEST">Mới nhất trước</option>
                    <option value="OLDEST">Cũ nhất trước</option>
                    <option value="UNREAD">Ưu tiên chưa đọc</option>
                    <option value="PRIORITY">Ưu tiên theo mức độ</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnreadOnly((current) => !current)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      showUnreadOnly
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
                    }`}
                  >
                    Chỉ hội thoại chưa đọc
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPinnedOnly((current) => !current)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      showPinnedOnly
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
                    }`}
                  >
                    Chỉ hội thoại đã ghim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatQuery("");
                      setChatStatusFilter("ALL");
                      setChatPriorityFilter("ALL");
                      setChatTagFilter("ALL");
                      setChatSort("LATEST");
                      setShowUnreadOnly(false);
                      setShowPinnedOnly(false);
                    }}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-teal-200 hover:text-teal-700"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-slate-900">
                  Danh sách hội thoại
                </p>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {filteredConversations.length} kết quả
                </span>
              </div>
              <div className="mt-4 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                {assignedConversations.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    Chưa có cuộc trò chuyện nào được giao.
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    Không có hội thoại phù hợp với bộ lọc hiện tại.
                  </p>
                ) : (
                  filteredConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`block w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                        selectedConversationId === conversation.id
                          ? "border-teal-700 bg-teal-50 shadow-sm"
                          : "border-gray-200 hover:border-teal-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {conversation.userName ||
                                `User #${conversation.userId}`}
                            </p>
                            {conversation.pinnedByStaff ? (
                              <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                Ghim
                              </span>
                            ) : null}
                            {Number(conversation.unreadByStaff || 0) > 0 ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                {conversation.unreadByStaff}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-1 text-[13px] text-gray-500">
                            {conversation.lastMessage || "Chưa có tin nhắn"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getConversationStatusClasses(conversation.status)}`}
                            >
                              {conversation.status}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getConversationPriorityClasses(conversation.priority)}`}
                            >
                              {getConversationPriorityLabel(
                                conversation.priority,
                              )}
                            </span>
                            {(conversation.tags ?? [])
                              .slice(0, 2)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-400">
                          <div>
                            {formatDateTime(conversation.updatedAt) ||
                              "Vừa xong"}
                          </div>
                          <div className="mt-1 truncate">
                            {getWaitingForLabel(conversation.waitingFor)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-[44rem] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold text-slate-900">
                      {activeConversation?.userName ||
                        "Chọn một cuộc trò chuyện"}
                    </p>
                    {activeConversation ? (
                      <>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getConversationStatusClasses(activeConversation.status)}`}
                        >
                          {activeConversation.status}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getConversationPriorityClasses(activeConversation.priority)}`}
                        >
                          {getConversationPriorityLabel(
                            activeConversation.priority,
                          )}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {activeConversation
                      ? `Khách hàng ID: ${activeConversation.userId || "—"} • ${getWaitingForLabel(activeConversation.waitingFor)} • Cập nhật lần cuối ${formatDateTime(activeConversation.updatedAt) || "vừa xong"}`
                      : "Chọn một hội thoại ở cột trái để bắt đầu hỗ trợ khách hàng."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleToggleConversationPinned()}
                    disabled={!activeConversation}
                    className="rounded-2xl border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {activeConversation?.pinnedByStaff
                      ? "Bỏ ghim"
                      : "Ghim hội thoại"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCloseConversation()}
                    disabled={
                      !activeConversation ||
                      activeConversation.status === "CLOSED"
                    }
                    className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Đóng hội thoại
                  </button>
                </div>
              </div>

              {activeConversation ? (
                <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Nhãn hội thoại
                      </p>
                      <p className="text-xs text-gray-400">
                        Chỉ dùng nội bộ cho staff
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {CHAT_LABEL_OPTIONS.map((tag) => {
                        const selected = (
                          activeConversation.tags ?? []
                        ).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              void handleToggleConversationTag(tag)
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              selected
                                ? "border-teal-200 bg-teal-50 text-teal-700"
                                : "border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      Mức ưu tiên
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {CHAT_PRIORITY_OPTIONS.filter(
                        (item) => item !== "ALL",
                      ).map((priority) => {
                        const selected =
                          String(
                            activeConversation.priority || "NORMAL",
                          ).toUpperCase() === priority;
                        return (
                          <button
                            key={priority}
                            type="button"
                            onClick={() =>
                              void handleSetConversationPriority(priority)
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              selected
                                ? getConversationPriorityClasses(priority)
                                : "border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
                            }`}
                          >
                            {getConversationPriorityLabel(priority)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {activeConversation ? (
              <div className="grid gap-0 border-b border-gray-100 lg:grid-cols-[1fr,20rem]">
                <div className="border-b border-gray-100 px-5 py-3 lg:border-b-0 lg:border-r">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_CHAT_REPLIES.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => setChatDraft(reply)}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-teal-200 hover:text-teal-700"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Ghi chú nội bộ
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSaveInternalNote()}
                      className="rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                  <textarea
                    value={internalNoteDraft}
                    onChange={(event) =>
                      setInternalNoteDraft(event.target.value)
                    }
                    rows={5}
                    placeholder="Ví dụ: khách hỏi về đơn #120, cần kiểm tra tồn kho hoặc chờ xác nhận thanh toán..."
                    className="mt-3 w-full resize-none rounded-2xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-5 py-5">
              {!activeConversation ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                  <MessageOutlined className="text-4xl" />
                  <p className="mt-4 text-base font-medium">
                    Chưa chọn hội thoại
                  </p>
                  <p className="mt-1 max-w-md text-sm">
                    Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu hỗ
                    trợ khách hàng.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
                  Khách hàng chưa gửi thêm tin nhắn nào.
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderRole === "STAFF";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[72%] rounded-2xl px-3 py-2.5 shadow-sm ${
                          mine
                            ? "bg-teal-700 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        {!mine && message.senderName ? (
                          <p className="mb-1 text-xs font-semibold text-teal-700">
                            {message.senderName}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap text-[13px] leading-5">
                          {message.content}
                        </p>
                        <p
                          className={`mt-2 text-[11px] ${
                            mine ? "text-teal-100" : "text-gray-400"
                          }`}
                        >
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-100 bg-white p-4">
              <div className="flex gap-3">
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={3}
                  disabled={
                    !activeConversation ||
                    activeConversation.status === "CLOSED"
                  }
                  placeholder="Nhập phản hồi cho khách hàng..."
                  className="min-h-[68px] flex-1 resize-none rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => void handleSendChat()}
                  disabled={
                    !activeConversation ||
                    activeConversation.status === "CLOSED"
                  }
                  className="rounded-3xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
              Staff portal
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Trang làm việc của nhân viên
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Staff sau khi đăng nhập sẽ làm việc trực tiếp tại đây, tách riêng
              hoàn toàn khỏi giao diện mua hàng của user.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Nhân viên đang đăng nhập
              </p>
              <p className="mt-1 font-semibold text-white">
                {displayName || "Nhân viên"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className="inline-flex items-center rounded-2xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-400"
            >
              <MessageOutlined className="mr-2" />
              Mở chat hỗ trợ
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <LogoutOutlined className="mr-2" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 lg:py-8">
        <div className="mb-6 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-[2rem] bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-700 p-6 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-100/90">
              Khu vực nhân viên
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Staff dashboard
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-50/90 md:text-base">
              Quản lý đơn hàng, tồn kho, khách hàng và hỗ trợ chat trong một
              giao diện gọn hơn, rõ việc hơn và bám sát đúng luồng xử lý của
              staff.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">
              Điều hướng nhanh
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              >
                Quản lý đơn hàng
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("books")}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              >
                Quản lý kho sách
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("customers")}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              >
                Danh sách khách hàng
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              >
                Chat hỗ trợ
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
              Đang tải dữ liệu dashboard staff...
            </div>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={items}
              className="staff-dashboard-tabs"
            />
          )}
        </div>
      </main>
    </div>
  );
}
