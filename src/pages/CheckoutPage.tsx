import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import {
  getDistrictsByProvinceCode,
  getProvinces,
  getWardsByDistrictCode,
} from "vn-provinces";
import axiosClient, { getAccessToken } from "../services/axiosClient";
import {
  getClaimedVouchers,
  type VoucherWalletItem,
} from "../utils/voucherWallet";
import type { CartItem } from "../utils/cart";
import {
  clearCheckoutSession,
  getCheckoutSession,
} from "../utils/checkoutSession";
import { parseJwtPayload } from "../utils/jwt";

type ShippingMethod = "standard" | "express";
type PaymentMethod = "cod" | "prepaid";

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

type AddressForm = Omit<SavedAddress, "id">;

const SAVED_ADDRESSES_KEY = "bookstore_saved_addresses";
const ORDER_UPDATED_EVENT = "bookstore:order:updated";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseMinOrderFromSubtitle(subtitle: string): number | null {
  if (!subtitle) return null;

  const compact = subtitle.toLowerCase().replace(/\s+/g, "");
  const kMatch = compact.match(/(\d+)k/);
  if (kMatch) {
    return Number(kMatch[1]) * 1000;
  }

  const plainMatch = compact.match(/(\d{4,})/);
  if (plainMatch) {
    return Number(plainMatch[1]);
  }

  return null;
}

function getVoucherPrimaryCategory(voucher: VoucherWalletItem): string | null {
  const categories = Array.isArray(voucher.applies_to_categories)
    ? voucher.applies_to_categories.filter((category) => category !== "ALL")
    : [];

  return categories.length > 0 ? categories[0] : null;
}

function getEligibleSubtotalForVoucher(
  voucher: VoucherWalletItem,
  selectedItems: CartItem[],
  subtotal: number,
): number {
  const minOrder = parseMinOrderFromSubtitle(voucher.subtitle);
  if (minOrder) {
    return subtotal >= minOrder ? subtotal : 0;
  }

  const primaryCategory = getVoucherPrimaryCategory(voucher);
  if (primaryCategory) {
    return selectedItems
      .filter((item) => item.categoryName === primaryCategory)
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  return subtotal;
}

function isValidVietnamPhone(phone: string): boolean {
  const normalized = phone.replace(/\s+/g, "");
  return /^0(?:3|5|7|8|9)\d{8}$/.test(normalized);
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
    // ignore
  }
}

function removeSavedAddressById(addressId: string): SavedAddress[] {
  const current = getSavedAddresses();
  const next = current.filter((address) => address.id !== addressId);
  saveAddresses(next);
  return next;
}

function getProvinceName(code: string): string {
  return getProvinces().find((province) => province.code === code)?.name ?? "";
}

function getDistrictName(provinceCode: string, districtCode: string): string {
  return (
    getDistrictsByProvinceCode(provinceCode).find(
      (district) => district.code === districtCode,
    )?.name ?? ""
  );
}

function getWardName(districtCode: string, wardCode: string): string {
  return (
    getWardsByDistrictCode(districtCode).find((ward) => ward.code === wardCode)
      ?.name ?? ""
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(
    null,
  );
  const [selectedFreeShipId, setSelectedFreeShipId] = useState<string | null>(
    null,
  );
  const [claimedVouchers, setClaimedVouchers] = useState<VoucherWalletItem[]>(
    [],
  );

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<AddressForm>({
    fullName: "",
    phone: "",
    addressLine: "",
    provinceCode: "",
    provinceName: "",
    districtCode: "",
    districtName: "",
    wardCode: "",
    wardName: "",
    postalCode: "",
  });
  const [addressError, setAddressError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const provinces = useMemo(() => getProvinces(), []);
  const districts = useMemo(
    () =>
      form.provinceCode ? getDistrictsByProvinceCode(form.provinceCode) : [],
    [form.provinceCode],
  );
  const wards = useMemo(
    () => (form.districtCode ? getWardsByDistrictCode(form.districtCode) : []),
    [form.districtCode],
  );

  useEffect(() => {
    const session = getCheckoutSession();
    if (!session || session.items.length === 0) {
      setItems([]);
      return;
    }

    setItems(session.items);
    setSelectedDiscountId(session.selectedDiscountId);
    setSelectedFreeShipId(session.selectedFreeShipId);
    setClaimedVouchers(getClaimedVouchers());

    const addresses = getSavedAddresses();
    setSavedAddresses(addresses);
    if (addresses.length > 0) {
      setSelectedAddressId(addresses[0].id);
    }
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );

  const selectedDiscountVoucher = useMemo(
    () =>
      claimedVouchers.find(
        (voucher) =>
          voucher.voucher_type === "discount" &&
          voucher.id === selectedDiscountId,
      ) ?? null,
    [claimedVouchers, selectedDiscountId],
  );

  const selectedFreeShipVoucher = useMemo(
    () =>
      claimedVouchers.find(
        (voucher) =>
          voucher.voucher_type === "freeship" &&
          voucher.id === selectedFreeShipId,
      ) ?? null,
    [claimedVouchers, selectedFreeShipId],
  );

  const eligibleDiscountSubtotal = useMemo(() => {
    if (!selectedDiscountVoucher) return 0;
    return getEligibleSubtotalForVoucher(
      selectedDiscountVoucher,
      items,
      subtotal,
    );
  }, [selectedDiscountVoucher, items, subtotal]);

  const discountAmount = selectedDiscountVoucher
    ? Math.min(
        eligibleDiscountSubtotal,
        Math.round(
          (eligibleDiscountSubtotal *
            selectedDiscountVoucher.discount_percent) /
            100,
        ),
      )
    : 0;

  const baseShippingFee = shippingMethod === "standard" ? 15000 : 30000;
  const shippingDiscount = selectedFreeShipVoucher
    ? Math.min(15000, baseShippingFee)
    : 0;
  const shippingFee = Math.max(0, baseShippingFee - shippingDiscount);
  const total = Math.max(0, subtotal - discountAmount + shippingFee);

  const selectedAddress = useMemo(
    () =>
      savedAddresses.find((address) => address.id === selectedAddressId) ??
      null,
    [savedAddresses, selectedAddressId],
  );

  const handleSaveAddress = () => {
    const phone = form.phone.trim();

    if (!form.fullName.trim() || !phone || !form.addressLine.trim()) {
      setAddressError(
        "Vui lòng nhập Tên, Số điện thoại và Địa chỉ trước khi lưu.",
      );
      return;
    }

    if (!isValidVietnamPhone(phone)) {
      setAddressError(
        "Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912345678.",
      );
      return;
    }

    if (!form.provinceCode || !form.districtCode || !form.wardCode) {
      setAddressError(
        "Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện và Phường/Xã.",
      );
      return;
    }

    const newAddress: SavedAddress = {
      id: `${Date.now()}`,
      fullName: form.fullName.trim(),
      phone,
      addressLine: form.addressLine.trim(),
      provinceCode: form.provinceCode,
      provinceName: getProvinceName(form.provinceCode),
      districtCode: form.districtCode,
      districtName: getDistrictName(form.provinceCode, form.districtCode),
      wardCode: form.wardCode,
      wardName: getWardName(form.districtCode, form.wardCode),
      postalCode: form.postalCode.trim(),
    };

    const next = [newAddress, ...savedAddresses];
    setSavedAddresses(next);
    saveAddresses(next);
    setSelectedAddressId(newAddress.id);
    setAddressError("");
    setForm({
      fullName: "",
      phone: "",
      addressLine: "",
      provinceCode: "",
      provinceName: "",
      districtCode: "",
      districtName: "",
      wardCode: "",
      wardName: "",
      postalCode: "",
    });
  };

  const handleDeleteAddress = (addressId: string) => {
    const next = removeSavedAddressById(addressId);
    setSavedAddresses(next);

    if (selectedAddressId === addressId) {
      setSelectedAddressId(next[0]?.id ?? null);
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedAddress && !form.fullName.trim()) {
      setAddressError(
        "Vui lòng chọn địa chỉ đã lưu hoặc nhập địa chỉ giao hàng.",
      );
      return;
    }

    const token = getAccessToken();
    const payload = token ? parseJwtPayload(token) : null;
    const userId = String(payload?.sub ?? "").trim();

    if (!userId) {
      setAddressError("Vui lòng đăng nhập lại để tạo đơn hàng.");
      return;
    }

    const shippingAddress = selectedAddress
      ? [
          selectedAddress.addressLine,
          selectedAddress.wardName,
          selectedAddress.districtName,
          selectedAddress.provinceName,
        ]
          .filter(Boolean)
          .join(", ")
      : [
          form.addressLine,
          getWardName(form.districtCode, form.wardCode),
          getDistrictName(form.provinceCode, form.districtCode),
          getProvinceName(form.provinceCode),
        ]
          .filter(Boolean)
          .join(", ");

    const orderPayload = {
      user_id: userId,
      promotion_id: selectedDiscountId ?? selectedFreeShipId ?? null,
      order_date: new Date().toISOString(),
      total_amount: total,
      shipping_address: shippingAddress,
      payment_method: paymentMethod === "cod" ? "COD" : "VNPay",
      order_status: "Đang xử lý",
      items: items.map((item) => ({
        book_item_id: item.id,
        title: item.title,
        unit_price: item.unitPrice,
      })),
    };

    try {
      await axiosClient.post("/orders", orderPayload);
      window.dispatchEvent(new Event(ORDER_UPDATED_EVENT));
    } catch {
      setAddressError("Không thể lưu đơn hàng vào db.json. Vui lòng thử lại.");
      return;
    }

    setAddressError("");
    setSuccessMessage(
      "Thanh toán thành công. Đơn hàng của bạn đang được xử lý.",
    );
    clearCheckoutSession();
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-700">Không có sản phẩm để thanh toán.</p>
            <Link
              to="/cart"
              className="mt-4 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Quay lại giỏ hàng
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-teal-900">
                1. Địa chỉ giao hàng
              </h2>
              <button
                type="button"
                onClick={handleSaveAddress}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                + Lưu địa chỉ
              </button>
            </div>

            {savedAddresses.length > 0 ? (
              <div className="mb-4 space-y-2 border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Địa chỉ đã lưu
                </p>
                {savedAddresses.map((address) => (
                  <div
                    key={address.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-white"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="saved-address"
                        checked={selectedAddressId === address.id}
                        onChange={() => setSelectedAddressId(address.id)}
                        className="mt-1 h-4 w-4 accent-teal-700"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>{address.fullName}</strong> - {address.phone}
                        <br />
                        {address.addressLine}
                        {address.wardName ? `, ${address.wardName}` : ""}
                        {address.districtName
                          ? `, ${address.districtName}`
                          : ""}
                        {address.provinceName
                          ? `, ${address.provinceName}`
                          : ""}
                        {address.postalCode ? ` (${address.postalCode})` : ""}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(address.id)}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Xoá
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Tên của bạn"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="Số điện thoại Việt Nam"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
              <input
                value={form.addressLine}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    addressLine: event.target.value,
                  }))
                }
                placeholder="Số nhà, tên đường, phường/xã"
                className="md:col-span-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
              <select
                value={form.provinceCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    provinceCode: event.target.value,
                    provinceName: getProvinceName(event.target.value),
                    districtCode: "",
                    districtName: "",
                    wardCode: "",
                    wardName: "",
                  }))
                }
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600"
              >
                <option value="">Tỉnh / Thành phố</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
              <select
                value={form.districtCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    districtCode: event.target.value,
                    districtName: getDistrictName(
                      prev.provinceCode,
                      event.target.value,
                    ),
                    wardCode: "",
                    wardName: "",
                  }))
                }
                disabled={!form.provinceCode}
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">Quận / Huyện</option>
                {districts.map((district) => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </select>
              <select
                value={form.wardCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    wardCode: event.target.value,
                    wardName: getWardName(
                      prev.districtCode,
                      event.target.value,
                    ),
                  }))
                }
                disabled={!form.districtCode}
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">Phường / Xã</option>
                {wards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
              <input
                value={form.postalCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    postalCode: event.target.value,
                  }))
                }
                placeholder="Mã bưu điện"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Số điện thoại hợp lệ: 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.
            </p>
            {addressError ? (
              <p className="mt-2 text-sm text-rose-600">{addressError}</p>
            ) : null}
          </div>

          <div className="bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-xl font-bold text-teal-900">
              2. Phương thức vận chuyển
            </h2>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-teal-200">
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === "standard"}
                  onChange={() => setShippingMethod("standard")}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span className="text-sm text-gray-700">
                  <strong>Giao hàng tiêu chuẩn</strong>
                  <br />
                  3-5 ngày làm việc - 15.000đ
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-teal-200">
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === "express"}
                  onChange={() => setShippingMethod("express")}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span className="text-sm text-gray-700">
                  <strong>Giao hàng hỏa tốc</strong>
                  <br />
                  Giao trong ngày - 30.000đ
                </span>
              </label>
            </div>
          </div>

          <div className="bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-xl font-bold text-teal-900">
              3. Thông tin thanh toán
            </h2>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-teal-200">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span className="text-sm text-gray-700">
                  <strong>Thanh toán khi nhận hàng</strong>
                  <br />
                  Thanh toán bằng tiền mặt khi nhận đơn.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-teal-200">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "prepaid"}
                  onChange={() => setPaymentMethod("prepaid")}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span className="text-sm text-gray-700">
                  <strong>Thanh toán trước</strong>
                  <br />
                  Chuyển khoản hoặc ví điện tử.
                </span>
              </label>
            </div>
          </div>
        </section>

        <aside className="h-fit bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Tóm tắt đơn hàng</h2>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 border-b border-gray-100 pb-3"
              >
                <img
                  src={
                    item.coverSrc || "https://picsum.photos/200/280?grayscale"
                  }
                  alt={item.title}
                  className="h-14 w-12 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500">SL: {item.quantity}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Giảm giá</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Vận chuyển</span>
              <span>{formatCurrency(shippingFee)}</span>
            </div>
            {shippingDiscount > 0 ? (
              <div className="flex items-center justify-between text-gray-600">
                <span>Giảm phí ship</span>
                <span>-{formatCurrency(shippingDiscount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900">
              <span>Tổng cộng</span>
              <span className="text-orange-700">{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompleteOrder}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-amber-800 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Hoàn tất thanh toán
          </button>

          {successMessage ? (
            <div className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="mt-3 w-full text-center text-sm font-medium text-gray-500 hover:text-teal-700"
          >
            Quay lại giỏ hàng
          </button>
        </aside>
      </main>

      <Footer />
    </div>
  );
}
