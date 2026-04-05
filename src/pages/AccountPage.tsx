import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { getAccessToken } from "../services/axiosClient";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import { parseJwtPayload } from "../utils/jwt";
import {
  getClaimedVouchers,
  subscribeVoucherUpdates,
  type VoucherWalletItem,
} from "../utils/voucherWallet";
import {
  getDistrictsByProvinceCode,
  getProvinces,
  getWardsByDistrictCode,
} from "vn-provinces";

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
};

type OrderRecord = {
  id: string;
  user_id: string;
  order_date: string;
  total_amount: number;
  shipping_address: string;
  payment_method: string;
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

const PROFILE_FORM_KEY = "bookstore_profile_form";
const PROFILE_AVATAR_KEY_PREFIX = "bookstore_profile_avatar";
const SAVED_ADDRESSES_KEY = "bookstore_saved_addresses";
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

function getStoredForm(): ProfileForm | null {
  try {
    const raw = localStorage.getItem(PROFILE_FORM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileForm;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredForm(form: ProfileForm): void {
  try {
    localStorage.setItem(PROFILE_FORM_KEY, JSON.stringify(form));
  } catch {
    // ignore storage errors
  }
}

function getAvatarStorageKey(userId: string): string {
  return `${PROFILE_AVATAR_KEY_PREFIX}:${userId}`;
}

function getStoredAvatar(userId: string): string {
  if (!userId) return "";

  try {
    return localStorage.getItem(getAvatarStorageKey(userId)) ?? "";
  } catch {
    return "";
  }
}

function saveStoredAvatar(userId: string, avatarDataUrl: string): void {
  if (!userId) return;

  try {
    localStorage.setItem(getAvatarStorageKey(userId), avatarDataUrl);
  } catch {
    // ignore storage errors
  }
}

function getSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(SAVED_ADDRESSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAddress[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAddresses(addresses: SavedAddress[]): void {
  try {
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(addresses));
  } catch {
    // ignore storage errors
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidVietnamPhone(phone: string): boolean {
  const normalized = phone.replace(/\s+/g, "");
  return /^0(?:3|5|7|8|9)\d{8}$/.test(normalized);
}

function validateProfileForm(form: ProfileForm): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  if (!form.fullName.trim()) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  }

  if (!form.email.trim()) {
    errors.email = "Vui lòng nhập email.";
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = "Email không hợp lệ.";
  }

  if (!form.phone.trim()) {
    errors.phone = "Vui lòng nhập số điện thoại.";
  } else if (!isValidVietnamPhone(form.phone)) {
    errors.phone = "Số điện thoại không hợp lệ.";
  }

  if (!form.shippingFullName.trim()) {
    errors.shippingFullName = "Vui lòng nhập người nhận.";
  }

  if (!form.shippingPhone.trim()) {
    errors.shippingPhone = "Vui lòng nhập số điện thoại nhận hàng.";
  } else if (!isValidVietnamPhone(form.shippingPhone)) {
    errors.shippingPhone = "Số điện thoại nhận hàng không hợp lệ.";
  }

  if (!form.shippingAddressLine.trim()) {
    errors.shippingAddressLine = "Vui lòng nhập địa chỉ chi tiết.";
  }

  if (!form.shippingProvince) {
    errors.shippingProvince = "Vui lòng chọn Tỉnh/Thành phố.";
  }

  if (!form.shippingDistrict) {
    errors.shippingDistrict = "Vui lòng chọn Quận/Huyện.";
  }

  if (!form.shippingWard) {
    errors.shippingWard = "Vui lòng chọn Phường/Xã.";
  }

  return errors;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [books, setBooks] = useState<DbBook[]>([]);
  const [bookItems, setBookItems] = useState<DbBookItem[]>([]);
  const [promotions, setPromotions] = useState<DbPromotionDetail[]>([]);
  const [vouchers, setVouchers] = useState<VoucherWalletItem[]>([]);
  const [form, setForm] = useState<ProfileForm>(getDefaultForm(null));
  const [loading, setLoading] = useState(true);
  const [profileNotice, setProfileNotice] = useState("");
  const [securityNotice, setSecurityNotice] = useState("");
  const [tokenDisplayName, setTokenDisplayName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [avatarSrc, setAvatarSrc] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherWalletItem | null>(null);

  const provinces = useMemo(() => getProvinces(), []);
  const districts = useMemo(
    () =>
      form.shippingProvince
        ? getDistrictsByProvinceCode(form.shippingProvince)
        : [],
    [form.shippingProvince],
  );
  const wards = useMemo(
    () =>
      form.shippingDistrict
        ? getWardsByDistrictCode(form.shippingDistrict)
        : [],
    [form.shippingDistrict],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const token = getAccessToken();
      const payload = token ? parseJwtPayload(token) : null;
      const userId = String(payload?.sub ?? "");
      const tokenFullName =
        typeof payload?.full_name === "string" ? payload.full_name : "";
      const tokenUsername =
        typeof payload?.username === "string" ? payload.username : "";
      const displayFromToken = tokenFullName || tokenUsername;

      setTokenDisplayName(displayFromToken);
      setCurrentUserId(userId);
      setAvatarSrc(getStoredAvatar(userId));

      if (!userId) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const [
          usersResponse,
          ordersResponse,
          booksResponse,
          bookItemsResponse,
          promotionsResponse,
        ] = await Promise.all([
          axiosClient.get("/users", { params: { id: userId } }),
          axiosClient.get("/orders"),
          axiosClient.get("/books"),
          axiosClient.get("/book_items"),
          axiosClient.get("/promotions"),
        ]);

        if (!isMounted) return;

        const foundUser = Array.isArray(usersResponse)
          ? ((usersResponse[0] as UserRecord | undefined) ?? null)
          : null;

        const nextOrders = Array.isArray(ordersResponse)
          ? (ordersResponse as OrderRecord[])
              .filter((order) => String(order.user_id) === String(userId))
              .slice()
          : [];

        const nextBooks = Array.isArray(booksResponse)
          ? (booksResponse as DbBook[])
          : [];
        const nextBookItems = Array.isArray(bookItemsResponse)
          ? (bookItemsResponse as DbBookItem[])
          : [];
        const nextPromotions = Array.isArray(promotionsResponse)
          ? (promotionsResponse as DbPromotionDetail[])
          : [];

        setUser(foundUser);
        setOrders(sortOrdersForDisplay(nextOrders));
        setBooks(nextBooks);
        setBookItems(nextBookItems);
        setPromotions(nextPromotions);
        setVouchers(getClaimedVouchers());

        const stored = getStoredForm();
        const allSavedAddresses = getSavedAddresses();
        const savedAddress = allSavedAddresses[0] ?? null;
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

        setSavedAddresses(allSavedAddresses);
        setSelectedAddressId(savedAddress?.id ?? null);
        setForm(stored ?? fallbackWithSavedAddress);
      } catch {
        if (!isMounted) return;
        const stored = getStoredForm();
        const allSavedAddresses = getSavedAddresses();
        const savedAddress = allSavedAddresses[0] ?? null;
        setVouchers(getClaimedVouchers());
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

        setSavedAddresses(allSavedAddresses);
        setSelectedAddressId(savedAddress?.id ?? null);
        setForm(stored ?? fallbackWithSavedAddress);
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
  }, []);

  useEffect(() => {
    const syncVouchers = () => {
      setVouchers(getClaimedVouchers());
    };

    syncVouchers();
    const unsubscribe = subscribeVoucherUpdates(syncVouchers);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    let disposed = false;

    const refreshOrders = async () => {
      try {
        const response = await axiosClient.get("/orders");

        if (disposed || !Array.isArray(response)) return;

        const nextOrders = (response as OrderRecord[])
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

  const handleSaveProfile = () => {
    if (isProfileSaved) {
      setIsProfileSaved(false);
      setProfileNotice("Bạn có thể chỉnh sửa thông tin và lưu lại.");
      window.setTimeout(() => setProfileNotice(""), 2500);
      return;
    }

    const errors = validateProfileForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setProfileNotice("Vui lòng nhập đầy đủ thông tin bắt buộc.");
      window.setTimeout(() => setProfileNotice(""), 2500);
      return;
    }

    setFormErrors({});
    saveStoredForm(form);

    const provinceName =
      provinces.find((province) => province.code === form.shippingProvince)
        ?.name ?? "";
    const districtName =
      districts.find((district) => district.code === form.shippingDistrict)
        ?.name ?? "";
    const wardName =
      wards.find((ward) => ward.code === form.shippingWard)?.name ?? "";

    const nextAddress: SavedAddress = {
      id: selectedAddressId ?? `${Date.now()}`,
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

    const currentSavedAddresses = getSavedAddresses();
    const nextSavedAddresses = [
      nextAddress,
      ...currentSavedAddresses.filter(
        (address) => address.id !== nextAddress.id,
      ),
    ];
    saveAddresses(nextSavedAddresses);
    setSavedAddresses(nextSavedAddresses);
    setSelectedAddressId(nextAddress.id);

    setIsProfileSaved(true);
    setProfileNotice("Đã lưu hồ sơ và địa chỉ giao hàng.");
    window.setTimeout(() => setProfileNotice(""), 2500);
  };

  const handleAddNewAddress = () => {
    setSelectedAddressId(null);
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
    const selected = savedAddresses.find((address) => address.id === addressId);
    if (!selected) return;

    setSelectedAddressId(selected.id);
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
    const nextSavedAddresses = savedAddresses.filter(
      (address) => address.id !== addressId,
    );

    setSavedAddresses(nextSavedAddresses);
    saveAddresses(nextSavedAddresses);
    setIsProfileSaved(false);

    if (selectedAddressId !== addressId) {
      setProfileNotice("Đã xoá địa chỉ đã lưu.");
      window.setTimeout(() => setProfileNotice(""), 2500);
      return;
    }

    const fallbackAddress = nextSavedAddresses[0] ?? null;
    setSelectedAddressId(fallbackAddress?.id ?? null);

    if (!fallbackAddress) {
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

    setProfileNotice("Đã xoá địa chỉ đã lưu.");
    window.setTimeout(() => setProfileNotice(""), 2500);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileNotice("Vui lòng chọn file ảnh hợp lệ.");
      window.setTimeout(() => setProfileNotice(""), 2500);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;

      setAvatarSrc(dataUrl);
      saveStoredAvatar(currentUserId, dataUrl);
      setProfileNotice("Đã cập nhật ảnh đại diện.");
      window.setTimeout(() => setProfileNotice(""), 2500);
    };
    reader.readAsDataURL(file);
  };

  const handleSecurityAction = (action: "password" | "logout") => {
    if (action === "password") {
      setSecurityNotice(
        "Tính năng đổi mật khẩu sẽ kết nối API ở bước tiếp theo.",
      );
      return;
    }

    localStorage.removeItem("access_token");
    navigate("/");
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

                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">
                      Địa chỉ giao hàng
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddNewAddress}
                      className="border border-teal-700 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      + Thêm địa chỉ
                    </button>
                  </div>

                  {savedAddresses.length > 0 ? (
                    <div className="mt-3 space-y-2 border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Địa chỉ đã lưu
                      </p>
                      {savedAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="flex items-start justify-between gap-3 text-sm text-gray-700"
                        >
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="radio"
                              name="saved-address"
                              checked={selectedAddressId === address.id}
                              onChange={() =>
                                handleSelectSavedAddress(address.id)
                              }
                              className="mt-1 h-4 w-4 accent-teal-700"
                            />
                            <span>
                              <strong>{address.fullName}</strong> -{" "}
                              {address.phone}
                              <br />
                              {address.addressLine}
                              {address.wardName ? `, ${address.wardName}` : ""}
                              {address.districtName
                                ? `, ${address.districtName}`
                                : ""}
                              {address.provinceName
                                ? `, ${address.provinceName}`
                                : ""}
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleDeleteSavedAddress(address.id)}
                            className="border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Xoá
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">
                        Người nhận
                      </span>
                      <input
                        value={form.shippingFullName}
                        onChange={(event) =>
                          handleFormChange(
                            "shippingFullName",
                            event.target.value,
                          )
                        }
                        readOnly={isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingFullName
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                      />
                      {formErrors.shippingFullName ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingFullName}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">
                        Số điện thoại nhận hàng
                      </span>
                      <input
                        value={form.shippingPhone}
                        onChange={(event) =>
                          handleFormChange("shippingPhone", event.target.value)
                        }
                        readOnly={isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingPhone
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                      />
                      {formErrors.shippingPhone ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingPhone}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-semibold text-gray-700">
                        Địa chỉ chi tiết
                      </span>
                      <input
                        value={form.shippingAddressLine}
                        onChange={(event) =>
                          handleFormChange(
                            "shippingAddressLine",
                            event.target.value,
                          )
                        }
                        readOnly={isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingAddressLine
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
                      />
                      {formErrors.shippingAddressLine ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingAddressLine}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">
                        Tỉnh / Thành phố
                      </span>
                      <select
                        value={form.shippingProvince}
                        onChange={(event) =>
                          handleShippingProvinceChange(event.target.value)
                        }
                        disabled={isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingProvince
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
                      >
                        <option value="">Chọn Tỉnh / Thành phố</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.shippingProvince ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingProvince}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">
                        Quận / Huyện
                      </span>
                      <select
                        value={form.shippingDistrict}
                        onChange={(event) =>
                          handleShippingDistrictChange(event.target.value)
                        }
                        disabled={!form.shippingProvince || isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingDistrict
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${!form.shippingProvince || isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
                      >
                        <option value="">Chọn Quận / Huyện</option>
                        {districts.map((district) => (
                          <option key={district.code} value={district.code}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.shippingDistrict ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingDistrict}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-semibold text-gray-700">
                        Phường / Xã
                      </span>
                      <select
                        value={form.shippingWard}
                        onChange={(event) =>
                          handleFormChange("shippingWard", event.target.value)
                        }
                        disabled={!form.shippingDistrict || isProfileSaved}
                        className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                          formErrors.shippingWard
                            ? "border-red-400"
                            : "border-gray-200"
                        } ${!form.shippingDistrict || isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
                      >
                        <option value="">Chọn Phường / Xã</option>
                        {wards.map((ward) => (
                          <option key={ward.code} value={ward.code}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.shippingWard ? (
                        <p className="text-xs text-red-600">
                          {formErrors.shippingWard}
                        </p>
                      ) : null}
                    </label>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
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
                  {profileNotice ? (
                    <p className="text-sm font-medium text-teal-700">
                      {profileNotice}
                    </p>
                  ) : null}
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
                                {isDeliveredOrder(order.order_status) ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProfileNotice(
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
                    onClick={() => handleSecurityAction("password")}
                    className="border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-teal-700 hover:text-teal-700"
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSecurityAction("logout")}
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
                {securityNotice ? (
                  <p className="text-sm font-medium text-teal-700">
                    {securityNotice}
                  </p>
                ) : null}
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
              onClick={() => handleSecurityAction("logout")}
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
