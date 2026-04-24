import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { clearAccessToken, getAccessToken } from "../services/axiosClient";
import { getBooks } from "../services/booksService";
import { getOrders } from "../services/ordersService";
import { getUserById } from "../services/usersService";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import ShippingAddressSection from "../components/common/ShippingAddressSection";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  setAvatarSrc as setAvatarSrcAction,
  setProfileForm,
  setSavedAddresses,
  setSelectedAddressId,
} from "../features/session/sessionSlice";
import { type VoucherWalletItem } from "../features/voucher/voucherSlice";
import { parseJwtPayload } from "../utils/jwt";
import {
  getDistrictsByProvinceCode,
  getProvinces,
  getWardsByDistrictCode,
  type AdministrativeOption,
} from "../utils/vnAdministrative";
import { signOutFirebaseUser } from "../firebase/client";

type UserRecord = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
};

type OrderItem = {
  book_item_id: string;
  title: string;
  unit_price: number;
  quantity?: number;
};

type OrderRecord = {
  id: string;
  user_id: string;
  order_date: string;
  total_amount: number;
  shipping_address: string;
  payment_method: string;
  payment_status?: string;
  order_status: string;
  items: OrderItem[];
};

type DbBook = {
  id: string | number;
  title: string;
  author_name?: string;
  cover_image?: string;
  selling_price?: number;
};

type DbBookItem = {
  id: string | number;
  book_id: string | number;
};

type DbPromotionDetail = {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  discount_percent: number;
  voucher_type?: "discount" | "freeship";
  applies_to_categories?: string[];
  condition_text?: string;
  valid_from?: string;
  valid_to?: string;
  terms?: string;
};

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine: string;
  shippingProvince: string;
  shippingDistrict: string;
  shippingWard: string;
};

type SectionKey = "profile" | "orders" | "vouchers" | "security";

type SavedAddress = {
  id: string;
  isDefault?: boolean;
  fullName: string;
  phone: string;
  addressLine: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  postalCode: string;
};

type ProfileFormErrors = Partial<Record<keyof ProfileForm, string>>;

const ORDER_UPDATED_EVENT = "bookstore:order:updated";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateText: string): string {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateText?: string): string {
  if (!dateText) return "Chưa cập nhật";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isVoucherExpiringSoon(validTo?: string, withinDays = 3): boolean {
  if (!validTo) return false;

  const end = new Date(validTo).getTime();
  if (Number.isNaN(end)) return false;

  const now = Date.now();
  const diff = end - now;
  if (diff < 0) return false;

  return diff <= withinDays * 24 * 60 * 60 * 1000;
}

function isDeliveredStatus(orderStatus: string): boolean {
  return String(orderStatus || "")
    .toLowerCase()
    .includes("đã giao");
}

function getPaymentStatusMeta(order: OrderRecord): {
  label: string;
  className: string;
} {
  const status = String(order.payment_status || "").trim().toLowerCase();
  const orderStatus = String(order.order_status || "").trim().toLowerCase();
  if (status.includes("paid") || status.includes("đã thanh toán")) {
    return {
      label: "Đã thanh toán",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (status.includes("failed") || status.includes("thất bại")) {
    return {
      label: "Thanh toán thất bại",
      className: "bg-rose-100 text-rose-700",
    };
  }
  if (orderStatus.includes("đang giao") || orderStatus.includes("shipping")) {
    return {
      label: "Đã thanh toán",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (String(order.payment_method || "").toLowerCase() === "vnpay") {
    return {
      label: "Chờ thanh toán VNPay",
      className: "bg-amber-100 text-amber-700",
    };
  }
  return {
    label: "Thanh toán khi nhận hàng",
    className: "bg-slate-100 text-slate-700",
  };
}

function sortOrdersForDisplay(orderList: OrderRecord[]): OrderRecord[] {
  return orderList.slice().sort((left, right) => {
    const leftDelivered = isDeliveredStatus(left.order_status);
    const rightDelivered = isDeliveredStatus(right.order_status);

    if (leftDelivered !== rightDelivered) {
      return leftDelivered ? 1 : -1;
    }

    return (
      new Date(right.order_date).getTime() - new Date(left.order_date).getTime()
    );
  });
}

function getDefaultForm(user: UserRecord | null): ProfileForm {
  return {
    fullName: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    shippingFullName: user?.full_name ?? "",
    shippingPhone: user?.phone ?? "",
    shippingAddressLine: "",
    shippingProvince: "",
    shippingDistrict: "",
    shippingWard: "",
  };
}

function getPreferredAddress(addresses: SavedAddress[]): SavedAddress | null {
  if (addresses.length === 0) return null;
  return addresses.find((address) => address.isDefault) ?? null;
}

function normalizeSavedAddresses(addresses: SavedAddress[]): SavedAddress[] {
  if (addresses.length === 0) return [];

  const hasExplicitDefaultState = addresses.some(
    (address) => typeof address.isDefault === "boolean",
  );

  if (!hasExplicitDefaultState) {
    return addresses.map((address, index) => ({
      ...address,
      isDefault: index === 0,
    }));
  }

  const defaultAddresses = addresses.filter((address) => address.isDefault);

  if (defaultAddresses.length <= 1) {
    return addresses.map((address) => ({
      ...address,
      isDefault: Boolean(address.isDefault),
    }));
  }

  const preferredId = defaultAddresses[0].id;

  return addresses.map((address) => ({
    ...address,
    isDefault: address.id === preferredId,
  }));
}

export default function AccountPage() {
  const {
    register,
    setValue: setFormValue,
    trigger,
    getFieldState,
  } = useForm<ProfileForm>({
    mode: "onChange",
    defaultValues: getDefaultForm(null),
  });
  const dispatch = useAppDispatch();
  const location = useLocation();
  const sessionUserId = useAppSelector((state) => state.session.userId);
  const storedProfileForm = useAppSelector(
    (state) => state.session.profileForm as ProfileForm,
  );
  const avatarSrc = useAppSelector((state) => state.session.avatarSrc);
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [books, setBooks] = useState<DbBook[]>([]);
  const [bookItems, setBookItems] = useState<DbBookItem[]>([]);
  const [promotions, setPromotions] = useState<DbPromotionDetail[]>([]);
  const vouchers = useAppSelector(
    (state) => state.voucher.claimedVouchers as VoucherWalletItem[],
  );
  const [form, setForm] = useState<ProfileForm>(getDefaultForm(null));
  const [loading, setLoading] = useState(true);
  const [tokenDisplayName, setTokenDisplayName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [isAddressFormVisible, setIsAddressFormVisible] = useState(false);
  const savedAddresses = useAppSelector(
    (state) => state.session.savedAddresses as SavedAddress[],
  );
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const selectedAddressId = useAppSelector(
    (state) => state.session.selectedAddressId,
  );
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherWalletItem | null>(null);
  const [handledVnpaySearch, setHandledVnpaySearch] = useState("");

  useEffect(() => {
    register("fullName", {
      required: "Vui lòng nhập họ và tên.",
      minLength: {
        value: 2,
        message: "Họ và tên phải có ít nhất 2 ký tự.",
      },
    });
    register("email", {
      required: "Vui lòng nhập email.",
      pattern: {
        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: "Email không hợp lệ.",
      },
    });
    register("phone", {
      required: "Vui lòng nhập số điện thoại.",
      pattern: {
        value: /^0(?:3|5|7|8|9)\d{8}$/,
        message: "Số điện thoại không hợp lệ.",
      },
    });
    register("shippingFullName", {
      required: "Vui lòng nhập người nhận.",
    });
    register("shippingPhone", {
      required: "Vui lòng nhập số điện thoại nhận hàng.",
      pattern: {
        value: /^0(?:3|5|7|8|9)\d{8}$/,
        message: "Số điện thoại nhận hàng không hợp lệ.",
      },
    });
    register("shippingAddressLine", {
      required: "Vui lòng nhập địa chỉ chi tiết.",
    });
    register("shippingProvince", {
      required: "Vui lòng chọn Tỉnh/Thành phố.",
    });
    register("shippingDistrict", {
      required: "Vui lòng chọn Quận/Huyện.",
    });
    register("shippingWard", {
      required: "Vui lòng chọn Phường/Xã.",
    });
  }, [register]);

  useEffect(() => {
    (Object.entries(form) as [keyof ProfileForm, string][]).forEach(
      ([field, value]) => {
        setFormValue(field, value, { shouldValidate: false });
      },
    );
  }, [form, setFormValue]);

  const [provinces, setProvinces] = useState<AdministrativeOption[]>([]);
  const [districts, setDistricts] = useState<AdministrativeOption[]>([]);
  const [wards, setWards] = useState<AdministrativeOption[]>([]);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const result = await getProvinces();
        if (!disposed) setProvinces(result);
      } catch {
        if (!disposed) setProvinces([]);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const result = form.shippingProvince
          ? await getDistrictsByProvinceCode(form.shippingProvince)
          : [];
        if (!disposed) setDistricts(result);
      } catch {
        if (!disposed) setDistricts([]);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [form.shippingProvince]);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const result = form.shippingDistrict
          ? await getWardsByDistrictCode(form.shippingDistrict)
          : [];
        if (!disposed) setWards(result);
      } catch {
        if (!disposed) setWards([]);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [form.shippingDistrict]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const token = getAccessToken();
      const payload = token ? parseJwtPayload(token) : null;
      const userId = sessionUserId || String(payload?.user_id ?? payload?.sub ?? "");
      const tokenFullName =
        typeof payload?.full_name === "string" ? payload.full_name : "";
      const tokenUsername =
        typeof payload?.username === "string" ? payload.username : "";
      const displayFromToken = tokenFullName || tokenUsername;

      setTokenDisplayName(displayFromToken);
      setCurrentUserId(userId);

      if (!userId) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const [foundUser, ordersResponse, nextBooks] = await Promise.all([
          getUserById(userId),
          getOrders(),
          getBooks(),
        ]);

        if (!isMounted) return;

        const nextOrders = Array.isArray(ordersResponse)
          ? ordersResponse
              .filter((order) => String(order.user_id) === String(userId))
              .slice()
          : [];

        setUser(foundUser);
        setOrders(sortOrdersForDisplay(nextOrders));
        setBooks(nextBooks);
        setBookItems([]);
        setPromotions([]);

        const allSavedAddresses = normalizeSavedAddresses(savedAddresses);
        const savedAddress = getPreferredAddress(allSavedAddresses);
        const fallbackForm = foundUser
          ? getDefaultForm(foundUser)
          : {
              ...getDefaultForm(null),
              fullName: displayFromToken,
              shippingFullName: displayFromToken,
            };
        const fallbackWithSavedAddress = savedAddress
          ? {
              ...fallbackForm,
              shippingFullName:
                savedAddress.fullName || fallbackForm.shippingFullName,
              shippingPhone: savedAddress.phone || fallbackForm.shippingPhone,
              shippingAddressLine: savedAddress.addressLine,
              shippingProvince: savedAddress.provinceCode,
              shippingDistrict: savedAddress.districtCode,
              shippingWard: savedAddress.wardCode,
            }
          : fallbackForm;

        if (JSON.stringify(allSavedAddresses) !== JSON.stringify(savedAddresses)) {
          dispatch(setSavedAddresses(allSavedAddresses));
        }
        dispatch(setSelectedAddressId(savedAddress?.id ?? null));
        setEditingAddressId(savedAddress?.id ?? null);
        setIsAddressFormVisible(false);
        setForm(storedProfileForm ?? fallbackWithSavedAddress);
      } catch {
        if (!isMounted) return;
        const allSavedAddresses = normalizeSavedAddresses(savedAddresses);
        const savedAddress = getPreferredAddress(allSavedAddresses);
        const fallback = {
          ...getDefaultForm(null),
          fullName: displayFromToken,
          shippingFullName: displayFromToken,
        };
        const fallbackWithSavedAddress = savedAddress
          ? {
              ...fallback,
              shippingFullName:
                savedAddress.fullName || fallback.shippingFullName,
              shippingPhone: savedAddress.phone || fallback.shippingPhone,
              shippingAddressLine: savedAddress.addressLine,
              shippingProvince: savedAddress.provinceCode,
              shippingDistrict: savedAddress.districtCode,
              shippingWard: savedAddress.wardCode,
            }
          : fallback;

        if (JSON.stringify(allSavedAddresses) !== JSON.stringify(savedAddresses)) {
          dispatch(setSavedAddresses(allSavedAddresses));
        }
        dispatch(setSelectedAddressId(savedAddress?.id ?? null));
        setEditingAddressId(savedAddress?.id ?? null);
        setIsAddressFormVisible(false);
        setForm(storedProfileForm ?? fallbackWithSavedAddress);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [dispatch, sessionUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    let disposed = false;

    const refreshOrders = async () => {
      try {
        const response = await getOrders();

        if (disposed || !Array.isArray(response)) return;

        const nextOrders = response
          .filter((order) => String(order.user_id) === String(currentUserId))
          .slice();

        setOrders(sortOrdersForDisplay(nextOrders));
      } catch {
        // keep existing orders when refresh fails
      }
    };

    void refreshOrders();

    const onFocus = () => {
      void refreshOrders();
    };

    const onOrderUpdated = () => {
      void refreshOrders();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(ORDER_UPDATED_EVENT, onOrderUpdated);

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(ORDER_UPDATED_EVENT, onOrderUpdated);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!location.search || handledVnpaySearch === location.search) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("source") !== "vnpay") return;

    const callbackStatus = String(searchParams.get("status") || "").trim();
    const orderId = String(searchParams.get("order_id") || "").trim();
    setActiveSection("orders");
    setShowAllOrders(true);
    setHandledVnpaySearch(location.search);

    if (callbackStatus === "success") {
      toast.success(
        orderId
          ? `Đơn LL-${orderId} đã thanh toán thành công qua VNPay.`
          : "Thanh toán VNPay thành công.",
      );
      if (!currentUserId) return;

      // IPN from VNPay may arrive a few seconds after redirect callback.
      // Poll briefly so customer sees the updated payment status right away.
      const pollOrdersAfterVnpay = async () => {
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            const response = await getOrders();
            const nextOrders = Array.isArray(response)
              ? response
                  .filter((order) => String(order.user_id) === String(currentUserId))
                  .slice()
              : [];
            const sortedOrders = sortOrdersForDisplay(nextOrders);
            setOrders(sortedOrders);

            const targetOrder = orderId
              ? sortedOrders.find((order) => String(order.id) === String(orderId))
              : sortedOrders[0];
            const paymentStatus = String(targetOrder?.payment_status || "")
              .trim()
              .toLowerCase();
            const orderStatus = String(targetOrder?.order_status || "")
              .trim()
              .toLowerCase();
            const isPaid =
              paymentStatus.includes("đã thanh toán") ||
              paymentStatus.includes("paid") ||
              orderStatus.includes("đang giao") ||
              orderStatus.includes("shipping");

            if (isPaid) {
              break;
            }
          } catch {
            // ignore transient polling errors
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      };

      void pollOrdersAfterVnpay();
      return;
    }
    if (callbackStatus === "invalid_signature") {
      toast.warning("Không xác thực được callback VNPay. Vui lòng kiểm tra lại.");
      return;
    }
    toast.info("Thanh toán VNPay chưa thành công. Bạn có thể thử lại.");
  }, [currentUserId, handledVnpaySearch, location.search]);

  const menuItems = useMemo(
    () => [
      { key: "profile" as const, label: "Hồ sơ" },
      { key: "orders" as const, label: "Đơn hàng gần đây" },
      { key: "vouchers" as const, label: "Mã giảm giá đã nhận" },
      { key: "security" as const, label: "Cài đặt và bảo mật" },
    ],
    [],
  );

  const handleFormChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setIsProfileSaved(false);
  };

  const handleShippingProvinceChange = (provinceCode: string) => {
    setForm((prev) => ({
      ...prev,
      shippingProvince: provinceCode,
      shippingDistrict: "",
      shippingWard: "",
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.shippingProvince;
      delete next.shippingDistrict;
      delete next.shippingWard;
      return next;
    });
    setIsProfileSaved(false);
  };

  const handleShippingDistrictChange = (districtCode: string) => {
    setForm((prev) => ({
      ...prev,
      shippingDistrict: districtCode,
      shippingWard: "",
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.shippingDistrict;
      delete next.shippingWard;
      return next;
    });
    setIsProfileSaved(false);
  };

  const handleSaveProfile = async () => {
    if (isProfileSaved) {
      setIsProfileSaved(false);
      toast.info("Bạn có thể chỉnh sửa thông tin và lưu lại.");
      return;
    }

    const isValid = await trigger(["fullName", "email", "phone"]);
    if (!isValid) {
      setFormErrors((prev) => ({
        ...prev,
        fullName:
          (getFieldState("fullName").error?.message as string | undefined) ||
          prev.fullName,
        email:
          (getFieldState("email").error?.message as string | undefined) ||
          prev.email,
        phone:
          (getFieldState("phone").error?.message as string | undefined) ||
          prev.phone,
      }));
      toast.error("Vui lòng nhập đầy đủ thông tin hồ sơ.");
      return;
    }

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.fullName;
      delete next.email;
      delete next.phone;
      return next;
    });
    dispatch(setProfileForm(form));

    setIsProfileSaved(true);
    toast.success("Đã lưu hồ sơ cá nhân.");
  };

  const handleSaveAddress = async () => {
    const isValid = await trigger([
      "shippingFullName",
      "shippingPhone",
      "shippingAddressLine",
      "shippingProvince",
      "shippingDistrict",
      "shippingWard",
    ]);

    if (!isValid) {
      setFormErrors((prev) => ({
        ...prev,
        shippingFullName:
          (getFieldState("shippingFullName").error?.message as
            | string
            | undefined) || prev.shippingFullName,
        shippingPhone:
          (getFieldState("shippingPhone").error?.message as
            | string
            | undefined) || prev.shippingPhone,
        shippingAddressLine:
          (getFieldState("shippingAddressLine").error?.message as
            | string
            | undefined) || prev.shippingAddressLine,
        shippingProvince:
          (getFieldState("shippingProvince").error?.message as
            | string
            | undefined) || prev.shippingProvince,
        shippingDistrict:
          (getFieldState("shippingDistrict").error?.message as
            | string
            | undefined) || prev.shippingDistrict,
        shippingWard:
          (getFieldState("shippingWard").error?.message as
            | string
            | undefined) || prev.shippingWard,
      }));
      toast.error("Vui lòng nhập đầy đủ thông tin địa chỉ.");
      return;
    }

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.shippingFullName;
      delete next.shippingPhone;
      delete next.shippingAddressLine;
      delete next.shippingProvince;
      delete next.shippingDistrict;
      delete next.shippingWard;
      return next;
    });

    const provinceName =
      provinces.find((province) => province.code === form.shippingProvince)
        ?.name ?? "";
    const districtName =
      districts.find((district) => district.code === form.shippingDistrict)
        ?.name ?? "";
    const wardName =
      wards.find((ward) => ward.code === form.shippingWard)?.name ?? "";

    const nextAddress: SavedAddress = {
      id: editingAddressId ?? `${Date.now()}`,
      isDefault: false,
      fullName: form.shippingFullName.trim() || form.fullName.trim(),
      phone: form.shippingPhone.trim() || form.phone.trim(),
      addressLine: form.shippingAddressLine.trim(),
      provinceCode: form.shippingProvince,
      provinceName,
      districtCode: form.shippingDistrict,
      districtName,
      wardCode: form.shippingWard,
      wardName,
      postalCode: "",
    };

    const currentSavedAddresses = normalizeSavedAddresses(savedAddresses);
    const existingAddress = currentSavedAddresses.find(
      (address) => address.id === nextAddress.id,
    );
    const mergedAddress = {
      ...nextAddress,
      isDefault:
        currentSavedAddresses.length === 0 || existingAddress?.isDefault,
    };
    const nextSavedAddresses = normalizeSavedAddresses([
      mergedAddress,
      ...currentSavedAddresses.filter(
        (address) => address.id !== mergedAddress.id,
      ),
    ]);
    dispatch(setSavedAddresses(nextSavedAddresses));
    dispatch(
      setSelectedAddressId(getPreferredAddress(nextSavedAddresses)?.id ?? null),
    );
    setEditingAddressId(mergedAddress.id);
    setIsAddressFormVisible(false);

    dispatch(setProfileForm(form));
    toast.success("Đã lưu địa chỉ giao hàng.");
  };

  const handleAddNewAddress = () => {
    setIsAddressFormVisible(true);
    setEditingAddressId(null);
    setIsProfileSaved(false);
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.shippingFullName;
      delete next.shippingPhone;
      delete next.shippingAddressLine;
      delete next.shippingProvince;
      delete next.shippingDistrict;
      delete next.shippingWard;
      return next;
    });

    setForm((prev) => ({
      ...prev,
      shippingFullName: prev.fullName,
      shippingPhone: prev.phone,
      shippingAddressLine: "",
      shippingProvince: "",
      shippingDistrict: "",
      shippingWard: "",
    }));
  };

  const handleSelectSavedAddress = (addressId: string) => {
    const nextSavedAddresses = normalizeSavedAddresses(
      savedAddresses.map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      })),
    );
    const selected = nextSavedAddresses.find(
      (address) => address.id === addressId,
    );
    if (!selected) return;

    dispatch(setSavedAddresses(nextSavedAddresses));
    setIsAddressFormVisible(true);
    dispatch(setSelectedAddressId(selected.id));
    setEditingAddressId(selected.id);
    setIsProfileSaved(false);
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.shippingFullName;
      delete next.shippingPhone;
      delete next.shippingAddressLine;
      delete next.shippingProvince;
      delete next.shippingDistrict;
      delete next.shippingWard;
      return next;
    });

    setForm((prev) => ({
      ...prev,
      shippingFullName: selected.fullName,
      shippingPhone: selected.phone,
      shippingAddressLine: selected.addressLine,
      shippingProvince: selected.provinceCode,
      shippingDistrict: selected.districtCode,
      shippingWard: selected.wardCode,
    }));
  };

  const handleDeleteSavedAddress = (addressId: string) => {
    const deletingAddress = savedAddresses.find(
      (address) => address.id === addressId,
    );
    const wasDefaultAddress = Boolean(deletingAddress?.isDefault);
    const nextSavedAddresses = normalizeSavedAddresses(
      savedAddresses.filter((address) => address.id !== addressId),
    );

    dispatch(setSavedAddresses(nextSavedAddresses));
    setIsProfileSaved(false);

    if (selectedAddressId !== addressId) {
      if (wasDefaultAddress) {
        dispatch(setSelectedAddressId(null));
      }
      toast.success("Đã xoá địa chỉ đã lưu.");
      return;
    }

    const fallbackAddress = getPreferredAddress(nextSavedAddresses);
    dispatch(setSelectedAddressId(fallbackAddress?.id ?? null));
    if (editingAddressId === addressId) {
      setEditingAddressId(fallbackAddress?.id ?? null);
    }

    if (!fallbackAddress) {
      setIsAddressFormVisible(false);
      setForm((prev) => ({
        ...prev,
        shippingAddressLine: "",
        shippingProvince: "",
        shippingDistrict: "",
        shippingWard: "",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        shippingFullName: fallbackAddress.fullName,
        shippingPhone: fallbackAddress.phone,
        shippingAddressLine: fallbackAddress.addressLine,
        shippingProvince: fallbackAddress.provinceCode,
        shippingDistrict: fallbackAddress.districtCode,
        shippingWard: fallbackAddress.wardCode,
      }));
    }

    toast.success("Đã xoá địa chỉ đã lưu.");
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;

      if (currentUserId && currentUserId === sessionUserId) {
        dispatch(setAvatarSrcAction(dataUrl));
      }
      toast.success("Đã cập nhật ảnh đại diện.");
    };
    reader.readAsDataURL(file);
  };

  const handleSecurityAction = async (action: "password" | "logout") => {
    if (action === "password") {
      toast.info("Tính năng đổi mật khẩu sẽ kết nối API ở bước tiếp theo.");
      return;
    }

    try {
      await signOutFirebaseUser();
    } catch {
      // Continue local logout even if Firebase sign-out fails.
    }
    clearAccessToken();
    navigate("/", { replace: true });
  };

  const displayName =
    user?.full_name || tokenDisplayName || form.fullName || "Khách hàng";
  const recentOrders = orders.slice(0, 2);
  const visibleOrders = showAllOrders ? orders : orders.slice(0, 6);
  const booksById = useMemo(
    () => new Map(books.map((book) => [String(book.id), book])),
    [books],
  );
  const bookItemsById = useMemo(
    () => new Map(bookItems.map((item) => [String(item.id), item])),
    [bookItems],
  );
  const promotionsById = useMemo(
    () =>
      new Map(promotions.map((promotion) => [String(promotion.id), promotion])),
    [promotions],
  );
  const selectedPromotionDetail = selectedVoucher
    ? (promotionsById.get(String(selectedVoucher.id)) ?? null)
    : null;
  const isSelectedVoucherExpiringSoon = isVoucherExpiringSoon(
    selectedPromotionDetail?.valid_to,
  );

  const isDeliveredOrder = (orderStatus: string): boolean =>
    isDeliveredStatus(orderStatus);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header hideSearch />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <div className="h-28 w-28 overflow-hidden rounded-full ring-2 ring-teal-100">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Ảnh đại diện"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-teal-700 text-3xl font-bold text-white">
                    {displayName.trim().charAt(0).toUpperCase() || "K"}
                  </div>
                )}
              </div>

              <label
                htmlFor="account-avatar-upload"
                className="inline-flex cursor-pointer border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                {avatarSrc ? "Chỉnh sửa ảnh" : "Thêm ảnh đại diện"}
              </label>
              <input
                id="account-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="md:pt-1">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">
                Tài khoản của tôi
              </p>
              <h1 className="mt-1 text-3xl font-bold text-teal-900">
                {displayName}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Quản lý hồ sơ cá nhân, địa chỉ giao hàng, đơn hàng và voucher đã
                nhận.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <section className="bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:order-2">
            {loading ? (
              <p className="text-sm text-gray-500">
                Đang tải thông tin tài khoản...
              </p>
            ) : activeSection === "profile" ? (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-teal-900">
                  Hồ sơ có thể chỉnh sửa
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-gray-700">
                      Họ và tên
                    </span>
                    <input
                      value={form.fullName}
                      onChange={(event) =>
                        handleFormChange("fullName", event.target.value)
                      }
                      readOnly={isProfileSaved}
                      className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                        formErrors.fullName
                          ? "border-red-400"
                          : "border-gray-200"
                      } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                    />
                    {formErrors.fullName ? (
                      <p className="text-xs text-red-600">
                        {formErrors.fullName}
                      </p>
                    ) : null}
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-gray-700">Email</span>
                    <input
                      value={form.email}
                      onChange={(event) =>
                        handleFormChange("email", event.target.value)
                      }
                      readOnly={isProfileSaved}
                      className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                        formErrors.email ? "border-red-400" : "border-gray-200"
                      } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                    />
                    {formErrors.email ? (
                      <p className="text-xs text-red-600">{formErrors.email}</p>
                    ) : null}
                  </label>

                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-semibold text-gray-700">
                      Số điện thoại
                    </span>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        handleFormChange("phone", event.target.value)
                      }
                      readOnly={isProfileSaved}
                      className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                        formErrors.phone ? "border-red-400" : "border-gray-200"
                      } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                    />
                    {formErrors.phone ? (
                      <p className="text-xs text-red-600">{formErrors.phone}</p>
                    ) : null}
                  </label>
                </div>

                <ShippingAddressSection
                  form={{
                    shippingFullName: form.shippingFullName,
                    shippingPhone: form.shippingPhone,
                    shippingAddressLine: form.shippingAddressLine,
                    shippingProvince: form.shippingProvince,
                    shippingDistrict: form.shippingDistrict,
                    shippingWard: form.shippingWard,
                  }}
                  formErrors={{
                    shippingFullName: formErrors.shippingFullName,
                    shippingPhone: formErrors.shippingPhone,
                    shippingAddressLine: formErrors.shippingAddressLine,
                    shippingProvince: formErrors.shippingProvince,
                    shippingDistrict: formErrors.shippingDistrict,
                    shippingWard: formErrors.shippingWard,
                  }}
                  isProfileSaved={isProfileSaved}
                  savedAddresses={savedAddresses}
                  selectedAddressId={selectedAddressId}
                  provinces={provinces}
                  districts={districts}
                  wards={wards}
                  onAddNewAddress={handleAddNewAddress}
                  onSelectSavedAddress={handleSelectSavedAddress}
                  onDeleteSavedAddress={handleDeleteSavedAddress}
                  onFormFieldChange={(field, value) =>
                    handleFormChange(field, value)
                  }
                  onShippingProvinceChange={handleShippingProvinceChange}
                  onShippingDistrictChange={handleShippingDistrictChange}
                  isAddressFormVisible={isAddressFormVisible}
                />

                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className={`px-5 py-2 text-sm font-semibold text-white ${
                        isProfileSaved
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-teal-700 hover:bg-teal-800"
                      }`}
                    >
                      {isProfileSaved ? "Chỉnh sửa" : "Lưu hồ sơ"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAddress}
                      className="bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Lưu địa chỉ
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-teal-900">
                      Đơn hàng gần đây
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllOrders(true);
                        setActiveSection("orders");
                      }}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      Xem tất cả đơn hàng
                    </button>
                  </div>

                  {recentOrders.length === 0 ? (
                    <p className="mt-3 border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                      Bạn chưa có đơn hàng nào gần đây.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {recentOrders.map((order) => (
                        <article
                          key={order.id}
                          className="rounded-md border border-gray-200 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-gray-500">
                                {formatDate(order.order_date)}
                              </p>
                              <h4 className="font-semibold text-teal-900">
                                Đơn hàng #{order.id}
                              </h4>
                              <p className="text-sm text-gray-700">
                                {order.items.length} sản phẩm •{" "}
                                {formatCurrency(order.total_amount)}
                              </p>
                            </div>
                            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                              {order.order_status}
                            </span>
                          </div>
                          <div className="mt-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusMeta(order).className}`}
                            >
                              {getPaymentStatusMeta(order).label}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeSection === "orders" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-teal-900">
                    Đơn hàng gần đây
                  </h2>
                  {orders.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllOrders((prev) => !prev)}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      {showAllOrders ? "Thu gọn" : "Xem tất cả"}
                    </button>
                  ) : null}
                </div>
                {orders.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    Bạn chưa có đơn hàng nào gần đây.
                  </p>
                ) : (
                  visibleOrders.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-md border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                        <div className="grid grid-cols-3 gap-6 text-xs text-gray-500">
                          <div>
                            <p className="uppercase tracking-wide">Ngày đặt</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {formatDate(order.order_date)}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide">Tổng tiền</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {formatCurrency(order.total_amount)}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide">Mã đơn</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              LL-{order.id}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                          {order.order_status}
                        </span>
                      </div>
                      <div className="mb-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusMeta(order).className}`}
                        >
                          {getPaymentStatusMeta(order).label}
                        </span>
                      </div>

                      <div className="mb-3 flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-amber-700 bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                        >
                          Đặt lại
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-gray-50"
                          onClick={() => navigate(`/checkout/${order.id}`)}
                        >
                          Xem chi tiết
                        </button>
                      </div>

                      <div className="space-y-3">
                        {order.items.map((item, index) => {
                          const itemId = String(item.book_item_id);
                          const mappedBookId =
                            bookItemsById.get(itemId)?.book_id ?? itemId;
                          const book = booksById.get(String(mappedBookId));
                          const unitPrice =
                            typeof book?.selling_price === "number"
                              ? book.selling_price
                              : item.unit_price;

                          return (
                            <div
                              key={`${order.id}-${item.book_item_id}-${index}`}
                              className="rounded-md grid gap-3 border border-gray-200 bg-white p-3 md:grid-cols-[64px_1fr_140px]"
                            >
                              <div className="h-24 w-16 overflow-hidden rounded-sm border border-gray-200 bg-gray-100">
                                {book?.cover_image ? (
                                  <img
                                    src={book.cover_image}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>

                              <div>
                                <h3 className="text-base font-semibold text-teal-900">
                                  {book?.title ?? item.title}
                                </h3>
                                <p className="mt-1 text-sm text-gray-600">
                                  {book?.author_name ?? "Tác giả chưa cập nhật"}
                                </p>
                                <p className="mt-3 text-sm font-semibold text-gray-800">
                                  {formatCurrency(unitPrice)}
                                </p>
                              </div>

                              <div className="flex items-center justify-center">
                                <div className="flex w-full flex-col items-end gap-2">
                                  <p className="text-xs font-semibold text-gray-500">
                                    SL: {item.quantity ?? 1}
                                  </p>
                                  {isDeliveredOrder(order.order_status) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toast.info(
                                          `Mở bình luận cho đơn LL-${order.id} (${item.title}).`,
                                        )
                                      }
                                      className="w-full rounded-md border border-teal-600 px-3 py-2 text-center text-xs font-semibold text-teal-700 hover:bg-teal-50"
                                    >
                                      Bình luận
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      -
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : activeSection === "vouchers" ? (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-teal-900">
                  Mã giảm giá đã nhận
                </h2>
                {vouchers.length === 0 ? (
                  <p className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    Chưa có voucher nào trong ví. Hãy vào trang chủ để nhận
                    voucher.
                  </p>
                ) : (
                  vouchers.map((voucher) => (
                    <article
                      key={voucher.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVoucher(voucher)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedVoucher(voucher);
                        }
                      }}
                      className="cursor-pointer border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-teal-900">
                            {voucher.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {voucher.subtitle}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Mã: {voucher.code} • Nhấn để xem chi tiết
                          </p>
                        </div>
                        <span className="bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                          -{voucher.discount_percent}%
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-teal-900">
                  Cài đặt và bảo mật
                </h2>
                <p className="text-sm text-gray-600">
                  Bạn có thể đổi mật khẩu hoặc đăng xuất khỏi tài khoản tại đây.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSecurityAction("password")}
                    className="border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-teal-700 hover:text-teal-700"
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSecurityAction("logout")}
                    className="border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Đăng xuất
                  </button>
                  <Link
                    to="/"
                    className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Về trang chủ
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="bg-white p-4 shadow-sm ring-1 ring-gray-100 lg:order-1">
            <p className="px-2 pb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
              Điều hướng tài khoản
            </p>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeSection === item.key
                      ? "bg-teal-700 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => void handleSecurityAction("logout")}
              className="mt-4 w-full border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Đăng xuất
            </button>
          </aside>
        </div>
      </main>

      {selectedVoucher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-teal-900">
                  {selectedVoucher.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Mã: {selectedVoucher.code}
                </p>
                {isSelectedVoucherExpiringSoon ? (
                  <span className="mt-2 inline-block bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    Sắp hết hạn
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Mức ưu đãi:</span>{" "}
                {selectedVoucher.voucher_type === "freeship"
                  ? "Giảm 100% phí vận chuyển"
                  : `Giảm ${selectedVoucher.discount_percent}%`}
              </p>
              <p>
                <span className="font-semibold">Điều kiện áp dụng:</span>{" "}
                {selectedPromotionDetail?.condition_text ??
                  selectedVoucher.subtitle}
              </p>
              <p>
                <span className="font-semibold">Danh mục áp dụng:</span>{" "}
                {(
                  selectedPromotionDetail?.applies_to_categories ??
                  selectedVoucher.applies_to_categories
                ).join(", ")}
              </p>
              <p>
                <span className="font-semibold">Thời gian hiệu lực:</span>{" "}
                {formatDateTime(selectedPromotionDetail?.valid_from)} -{" "}
                {formatDateTime(selectedPromotionDetail?.valid_to)}
              </p>
              <p>
                <span className="font-semibold">Điều khoản:</span>{" "}
                {selectedPromotionDetail?.terms ??
                  "Áp dụng theo chính sách của chương trình khuyến mãi."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
