import CountdownTimer from "../common/CountdownTimer";

type HomeBannerProps = {
  flashSaleCampaignName?: string;
  flashSaleEndsAt?: string;
  onFlashSaleExpired?: () => void;
};

export default function HomeBanner({
  flashSaleCampaignName,
  flashSaleEndsAt,
  onFlashSaleExpired,
}: HomeBannerProps) {
  const isFlashSaleActive = Boolean(
    flashSaleCampaignName && flashSaleCampaignName.trim() && flashSaleEndsAt,
  );

  return (
    <div className="w-full flex justify-center mt-6 px-4">
      <div className="relative w-full max-w-7xl overflow-hidden min-h-112.5 flex items-center shadow-lg">
        <div className="absolute inset-0 z-0">
          <img
            src="src\asset\pngtree-sunlit-sanctuary-antique-books-in-a-wooden-library-image_19832214.webp"
            alt="Library Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#093e44] via-[#093e44]/85 to-transparent"></div>
        </div>
        <div className="relative z-10 p-15 md:p-10 w-full max-w-3xl">
          <span className="inline-block bg-[#7a3911] text-white text-xs font-bold px-4 py-1.5 rounded-4xl mb-6 tracking-wide">
            {isFlashSaleActive
              ? "SỰ KIỆN FLASH SALE ĐANG DIỄN RA"
              : "PHÁT HÀNH ĐẶC BIỆT"}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-['Merriweather'] font-bold text-white leading-snug mb-6">
            {isFlashSaleActive
              ? `Flash sale ${flashSaleCampaignName}`
              : "Khám phá thế giới qua những trang sách mới"}
          </h1>
          <p className="text-gray-200 text-base md:text-lg mb-10 leading-relaxed opacity-90">
            {isFlashSaleActive
              ? "Săn deal theo thời gian thực, số lượng giới hạn, giá ưu đãi sâu chỉ trong khung giờ sự kiện."
              : "Bộ sưu tập văn học kinh điển được tái bản với thiết kế bìa nghệ thuật độc quyền chỉ có tại Sách Xanh."}
          </p>
          {isFlashSaleActive && flashSaleEndsAt ? (
            <div className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="text-base font-semibold text-white/90">
                Kết thúc sau:
              </span>
              <CountdownTimer
                endsAt={flashSaleEndsAt}
                onExpired={onFlashSaleExpired}
              />
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <button className="bg-[#7a3911] hover:bg-[#5c2a0c] text-white font-semibold py-2 px-9 rounded cursor-pointer transition-colors duration-300 border border-[#7a3911]">
                Khám phá ngay
              </button>
              <button className="bg-white/5 hover:bg-white/20 text-white font-semibold py-2 px-9 rounded cursor-pointer transition-colors duration-300 border border-gray-400/50 backdrop-blur-sm">
                Danh sách mới
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
