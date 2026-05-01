import { type VoucherWalletItem } from "../../features/voucher/voucherSlice";

type PromotionRecord = {
  id: string;
  code: string;
  title?: string;
  description?: string;
  discountPercent: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  usedCount: number;
  startDate?: string;
  endDate?: string;
  status: number;
  applicableCategories: string[];
  voucher_type?: "discount" | "freeship";
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherWalletItem | null;
  promotionDetail?: PromotionRecord | null;
  isExpiringSoon?: boolean;
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

export default function VoucherDetailModal({
  isOpen,
  onClose,
  voucher,
  promotionDetail,
  isExpiringSoon = false,
}: Props) {
  if (!isOpen || !voucher) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 px-4 py-8" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-teal-800 md:text-xl">
              Chi tiết voucher
            </h3>
            {isExpiringSoon ? (
              <span className="mt-2 inline-block bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                Sắp hết hạn
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:border-teal-600 hover:text-teal-700"
          >
            Đóng
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
            <div className="text-base font-bold text-teal-800">
              {voucher.title}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Mã voucher
              </div>
              <div className="mt-1 text-sm font-bold text-gray-800">
                {voucher.code}
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Mức giảm
              </div>
              <div className="mt-1 text-sm font-bold text-gray-800">
                {promotionDetail?.voucher_type === "freeship"
                  ? "100% phí vận chuyển"
                  : `${voucher.discount_percent}%`}
              </div>
            </div>

            {promotionDetail && (
              <>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Đơn tối thiểu
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {typeof promotionDetail.minOrderValue === "number"
                      ? formatCurrency(promotionDetail.minOrderValue)
                      : "Không yêu cầu"}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Giảm tối đa
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {typeof promotionDetail.maxDiscountAmount === "number"
                      ? formatCurrency(promotionDetail.maxDiscountAmount)
                      : "Không giới hạn"}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Hiệu lực từ
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {formatDateLabel(promotionDetail.startDate)}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Hiệu lực đến
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {formatDateLabel(promotionDetail.endDate)}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Lượt dùng
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {typeof promotionDetail.usedCount === "number"
                      ? `${promotionDetail.usedCount}${
                          typeof promotionDetail.usageLimit === "number"
                            ? ` / ${promotionDetail.usageLimit}`
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
                    {formatStatusLabel(promotionDetail.status)}
                  </div>
                </div>
              </>
            )}
          </div>

          {promotionDetail && (
            <>
              <div className="rounded-lg border border-gray-100 px-3 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Danh mục áp dụng
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {promotionDetail.applicableCategories &&
                  promotionDetail.applicableCategories.length > 0
                    ? promotionDetail.applicableCategories.join(", ")
                    : "Tất cả danh mục"}
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 px-3 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mô tả
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {promotionDetail.description ||
                    voucher.subtitle ||
                    "Chưa có mô tả."}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
