import { useEffect, useMemo, useState } from "react";
import { RightOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { fetchCatalog } from "../features/books/booksSlice";

import { type BookCardData } from "../components/common/BookCard";
import VoucherCard, {
  type VoucherCardData,
} from "../components/common/VoucherCard";

import HomeBanner from "../components/layouts/HomeBanner";
import BookSlider from "../components/common/BookSlider";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import {
  claimVoucher as claimVoucherAction,
  type VoucherWalletItem,
} from "../features/voucher/voucherSlice";
import { toast } from "react-toastify";

type DbBook = {
  id: string;
  title: string;
  author_name: string;
  original_price: number;
  selling_price: number;
  category_name: string;
  cover_image: string;
  sold_count: number;
  rental_count: number;
};

type DbPromotion = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discount_percent: number;
  applies_to_categories?: string[];
  voucher_type?: "discount" | "freeship";
  condition_text?: string;
  valid_from?: string;
  valid_to?: string;
  terms?: string;
};

type DbReview = {
  id: string;
  book_id: string;
  rating: number;
  is_approved: number;
};

type RatingStats = {
  average: number;
  count: number;
};

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

function mapBook(book: DbBook, ratingStats?: RatingStats): BookCardData {
  return {
    id: String(book.id),
    title: book.title,
    author: book.author_name,
    categoryName: book.category_name,
    price: formatCurrency(book.selling_price),
    unitPrice: book.selling_price,
    oldPrice:
      book.original_price > book.selling_price
        ? formatCurrency(book.original_price)
        : undefined,
    coverSrc: book.cover_image,
    rating: ratingStats?.average,
    ratingCount: ratingStats?.count,
  };
}

export function SectionHeader({
  title,
  to,
  onClick,
}: {
  title: string;
  to?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg md:text-xl font-bold text-teal-800 hover:text-teal-700">
        {title}
      </h2>
      {to ? (
        <Link
          to={to}
          className="text-sm text-teal-800 hover:text-teal-700 font-semibold inline-flex items-center gap-1"
        >
          Xem tất cả <RightOutlined className="text-xs" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="text-sm text-teal-800 hover:text-teal-700 font-semibold inline-flex items-center gap-1"
        >
          Xem tất cả <RightOutlined className="text-xs" />
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const dispatch = useAppDispatch();
  const books = useAppSelector((state) => state.books.books as DbBook[]);
  const promotions = useAppSelector(
    (state) => state.books.promotions as DbPromotion[],
  );
  const claimedVouchers = useAppSelector(
    (state) => state.voucher.claimedVouchers as VoucherWalletItem[],
  );
  const claimedVoucherIds = useMemo(
    () => claimedVouchers.map((item) => item.id),
    [claimedVouchers],
  );
  const reviews = useAppSelector((state) => state.books.reviews as DbReview[]);
  const [isVoucherPopupOpen, setIsVoucherPopupOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<DbPromotion | null>(
    null,
  );

  useEffect(() => {
    void dispatch(fetchCatalog());
  }, [dispatch]);

  const loading = useAppSelector((state) => state.books.loading);
  const error = useAppSelector((state) => state.books.error);

  const ratingMap = useMemo(() => {
    const approved = reviews.filter(
      (review) => Number(review.is_approved) === 1,
    );
    const bucket = new Map<string, { sum: number; count: number }>();

    approved.forEach((review) => {
      const key = String(review.book_id);
      const current = bucket.get(key) || { sum: 0, count: 0 };
      bucket.set(key, {
        sum: current.sum + review.rating,
        count: current.count + 1,
      });
    });

    const result = new Map<string, RatingStats>();
    bucket.forEach((value, key) => {
      result.set(key, {
        average: Number((value.sum / value.count).toFixed(1)),
        count: value.count,
      });
    });

    return result;
  }, [reviews]);

  const bestSellers = useMemo(
    () =>
      [...books]
        .sort((left, right) => right.sold_count - left.sold_count)
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const newArrivals = useMemo(
    () =>
      [...books]
        .sort((left, right) => Number(right.id) - Number(left.id))
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const kidsBooks = useMemo(
    () =>
      books
        .filter((book) => book.category_name === "Thiếu nhi")
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const learningBooks = useMemo(
    () =>
      books
        .filter((book) => book.category_name === "Học tập")
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const classicBooks = useMemo(
    () =>
      books
        .filter((book) => book.category_name === "Tiểu thuyết")
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const scienceBooks = useMemo(
    () =>
      books
        .filter((book) => book.category_name === "Khoa học")
        .slice(0, 6)
        .map((book) => mapBook(book, ratingMap.get(String(book.id)))),
    [books, ratingMap],
  );

  const allVouchers: VoucherCardData[] = useMemo(
    () => promotions.map(toVoucherCardData),
    [promotions],
  );

  const vouchers = useMemo(() => allVouchers.slice(0, 7), [allVouchers]);

  const handleClaimVoucher = (voucher: VoucherCardData) => {
    if (claimedVoucherIds.includes(voucher.id)) {
      return;
    }

    dispatch(
      claimVoucherAction({
        id: voucher.id,
        code: voucher.code,
        title: voucher.title,
        subtitle: voucher.subtitle,
        discount_percent: voucher.discount_percent,
        applies_to_categories: voucher.applies_to_categories,
        voucher_type: voucher.voucher_type || "discount",
      }),
    );

    toast.success("Đã nhận mã giảm giá thành công");
  };

  const handleOpenVoucherDetails = (voucher: VoucherCardData) => {
    const found = promotions.find((item) => item.id === voucher.id);
    if (!found) return;
    setSelectedVoucher(found);
  };

  const selectedVoucherCard = selectedVoucher
    ? toVoucherCardData(selectedVoucher)
    : null;

  return (
    <div className="bg-gray-50">
      <Header />
      <HomeBanner />

      {error ? (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 md:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      ) : null}

      <div className="w-full flex justify-center mt-6 px-4 md:px-8 pb-16">
        <div className="w-full max-w-7xl bg-white border border-gray-100 min-w-0 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-gray-500">
              Đang tải dữ liệu từ backend...
            </div>
          ) : null}

          {!loading ? (
            <BookSlider
              title="Sách bán chạy nhất"
              books={bestSellers}
              viewAllTo="/search?sort=sold-desc"
            />
          ) : null}

          {!loading ? (
            <BookSlider
              title="Sách mới về"
              books={newArrivals}
              viewAllTo="/search?sort=newest"
            />
          ) : null}

          {!loading ? (
            <BookSlider
              title="Sách thiếu nhi"
              books={kidsBooks}
              viewAllTo="/search?category=Thiếu+nhi"
            />
          ) : null}

          <section className=" p-4 md:p-5 w-full overflow-hidden">
            <SectionHeader
              title="Ưu đãi & Voucher đặc quyền"
              onClick={() => setIsVoucherPopupOpen(true)}
            />
            <div className="mt-4 flex overflow-x-auto gap-3 pb-2 custom-scrollbar">
              {vouchers.map((v) => (
                <VoucherCard
                  key={v.id}
                  data={v}
                  claimed={claimedVoucherIds.includes(v.id)}
                  onClaim={handleClaimVoucher}
                />
              ))}
            </div>
          </section>

          {!loading ? (
            <BookSlider
              title="Sách kỹ năng sống"
              books={learningBooks}
              viewAllTo="/search?category=Học+tập"
            />
          ) : null}

          {!loading ? (
            <BookSlider
              title="Sách văn học kinh điển"
              books={classicBooks}
              viewAllTo="/search?category=Tiểu+thuyết"
            />
          ) : null}

          {!loading ? (
            <BookSlider
              title="Sách khoa học phổ thông"
              books={scienceBooks}
              viewAllTo="/search?category=Khoa+học"
            />
          ) : null}
        </div>
      </div>
      <Footer />

      {isVoucherPopupOpen ? (
        <div
          className="fixed inset-0 z-70 bg-black/45 px-4 py-6 md:py-10"
          onClick={() => {
            setSelectedVoucher(null);
            setIsVoucherPopupOpen(false);
          }}
        >
          <div
            className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
              <h3 className="text-lg font-bold text-teal-800 md:text-xl">
                Danh sách voucher
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucher(null);
                  setIsVoucherPopupOpen(false);
                }}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition-colors hover:border-teal-600 hover:text-teal-700"
              >
                Đóng
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {allVouchers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Hiện chưa có voucher nào.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {allVouchers.map((voucher) => (
                    <VoucherCard
                      key={voucher.id}
                      data={voucher}
                      claimed={claimedVoucherIds.includes(voucher.id)}
                      onClaim={handleClaimVoucher}
                      onOpenDetails={handleOpenVoucherDetails}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

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
                  </div>

                  <div className="rounded-lg border border-gray-100 px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Điều kiện áp dụng
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      {selectedVoucher.condition_text ||
                        "Không có điều kiện cụ thể."}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Điều khoản
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      {selectedVoucher.terms || "Không có điều khoản bổ sung."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
