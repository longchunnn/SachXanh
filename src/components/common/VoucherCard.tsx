import { TagOutlined } from "@ant-design/icons";

export type VoucherCardData = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discount_percent: number;
  applies_to_categories?: string[];
  voucher_type?: "discount" | "freeship";
};

type Props = {
  data: VoucherCardData;
  claimed?: boolean;
  onClaim?: (voucher: VoucherCardData) => void;
  onOpenDetails?: (voucher: VoucherCardData) => void;
};

export default function VoucherCard({
  data,
  claimed = false,
  onClaim,
  onOpenDetails,
}: Props) {
  return (
    // 1. LỚP NGOÀI CÙNG: Thêm w-[320px] (hoặc w-80) để khóa cứng chiều ngang
    <div
      className="w-[320px] bg-white border shrink-0 border-gray-100 rounded-xl p-4 hover:border-teal-600 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onOpenDetails?.(data)}
    >
      {/* Đổi items-start thành items-center để nút bấm và logo căn giữa đều nhau */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-800 shrink-0">
          <TagOutlined />
        </div>

        {/* 2. PHẦN CHỮ: Thêm flex-1 để nó chiếm hết khoảng trống, đẩy nút Nhận dạt hẳn sang phải */}
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold text-gray-800 truncate"
            title={data.title}
          >
            {data.title}
          </div>
          <div
            className="text-sm text-gray-500 mt-1 truncate"
            title={data.subtitle}
          >
            {data.subtitle}
          </div>
        </div>

        {/* 3. NÚT BẤM: Bo tròn (rounded-full), tô màu Xanh mòng két (teal-600), chống méo (shrink-0) */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClaim?.(data);
          }}
          disabled={claimed}
          className="shrink-0 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full text-sm font-semibold transition-colors shadow-sm"
        >
          {claimed ? "Đã nhận" : "Nhận"}
        </button>
      </div>
    </div>
  );
}
