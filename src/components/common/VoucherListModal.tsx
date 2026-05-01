import { useState } from "react";
import VoucherCard, { type VoucherCardData } from "./VoucherCard";

// Types
export type DbPromotion = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discount_percent: number;
  max_discount_amount?: number;
  min_order_value?: number;
  usage_limit?: number;
  used_count?: number;
  status?: number;
  applies_to_categories?: string[];
  voucher_type?: "discount" | "freeship";
  valid_from?: string;
  valid_to?: string;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  vouchers: VoucherCardData[];
  allPromotions?: DbPromotion[];
  claimedVoucherIdSet: Set<string>;
  onClaim?: (voucher: VoucherCardData) => void;
};

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(dateText?: string): string {
  if (!dateText) return "Chưa cập nhật";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatusLabel(status?: number): string {
  if (status === 1) return "Đang hoạt động";
  if (status === 0) return "Không hoạt động";
  if (typeof status === "number" && Number.isFinite(status))
    return String(status);
  return "Chưa cập nhật";
}

function toVoucherCardData(promotion: DbPromotion): VoucherCardData {
  return {
    id: promotion.id,
    title:
      promotion.voucher_type === "freeship"
        ? "Giảm 100% phí vận chuyển"
        : promotion.title,
    subtitle:
      promotion.voucher_type === "freeship"
        ? "Áp dụng cho phí ship tiêu chuẩn"
        : promotion.subtitle,
    code: promotion.code,
    discount_percent: promotion.discount_percent,
    applies_to_categories: promotion.applies_to_categories,
    voucher_type: promotion.voucher_type,
  };
}

export default function VoucherListModal({
  isOpen,
  onClose,
  vouchers,
  allPromotions = [],
  claimedVoucherIdSet,
  onClaim,
}: Props) {
  const [selectedVoucher, setSelectedVoucher] = useState<DbPromotion | null>(
    null,
  );

  if (!isOpen) return null;

  const selectedVoucherCard = selectedVoucher
    ? toVoucherCardData(selectedVoucher)
    : null;

  const handleClose = () => {
    setSelectedVoucher(null);
    onClose();
  };

  const handleOpenDetails = (voucher: VoucherCardData) => {
    const found = allPromotions.find((item) => item.id === voucher.id);
    if (!found) return;
    setSelectedVoucher(found);
  };

  const handleClaimVoucher = (voucher: VoucherCardData) => {
    if (claimedVoucherIdSet.has(String(voucher.id))) {
      return;
    }
    onClaim?.(voucher);
  };

  return (
    <>
      {/* Main Modal */}
      <div
        className="fixed inset-0 z-70 bg-black/45 px-4 py-6 md:py-10"
        onClick={handleClose}
      >
        <div
          className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
            <h3 className="text-lg font-bold text-teal-800 md:text-xl">
              Danh sách voucher
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:border-teal-600 hover:text-teal-700"
            >
              Đóng
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {vouchers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Hiện chưa có voucher nào.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {vouchers.map((voucher) => (
                  <VoucherCard
                    key={voucher.id}
                    data={voucher}
                    claimed={claimedVoucherIdSet.has(String(voucher.id))}
                    onClaim={handleClaimVoucher}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Modal - Nested */}
        {selectedVoucher && selectedVoucherCard ? (
          <div
            className="fixed inset-0 z-80 bg-black/45 px-4 py-8"
            onClick={() => setSelectedVoucher(null)}
          >
            <div
              className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl md:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-teal-800 md:text-xl">
                  Chi tiết voucher
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:border-teal-600 hover:text-teal-700"
                >
                  Đóng
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
                  <div className="text-base font-bold text-teal-800">
                    {selectedVoucherCard.title}
                  </div>
                  <div className="mt-1 text-sm text-teal-700">
                    {selectedVoucherCard.subtitle}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mã voucher
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {selectedVoucher.code}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mức giảm
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {selectedVoucher.voucher_type === "freeship"
                        ? "100% phí vận chuyển"
                        : `${selectedVoucher.discount_percent}%`}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Đơn tối thiểu
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {typeof selectedVoucher.min_order_value === "number"
                        ? formatCurrency(selectedVoucher.min_order_value)
                        : "Không yêu cầu"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Giảm tối đa
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {typeof selectedVoucher.max_discount_amount === "number"
                        ? formatCurrency(selectedVoucher.max_discount_amount)
                        : "Không giới hạn"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Hiệu lực từ
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {formatDateLabel(selectedVoucher.valid_from)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Hiệu lực đến
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {formatDateLabel(selectedVoucher.valid_to)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Lượt dùng
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {typeof selectedVoucher.used_count === "number"
                        ? `${selectedVoucher.used_count}${
                            typeof selectedVoucher.usage_limit === "number"
                              ? ` / ${selectedVoucher.usage_limit}`
                              : ""
                          }`
                        : "Chưa cập nhật"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Trạng thái
                    </div>
                    <div className="mt-1 text-sm font-bold text-gray-800">
                      {formatStatusLabel(selectedVoucher.status)}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Danh mục áp dụng
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {selectedVoucher.applies_to_categories &&
                    selectedVoucher.applies_to_categories.length > 0
                      ? selectedVoucher.applies_to_categories.join(", ")
                      : "Tất cả danh mục"}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Mô tả
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {selectedVoucher.subtitle || "Chưa có mô tả."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
