import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Pagination } from "antd";
import { toast } from "react-toastify";
import Find from "../../components/common/Find";
import BookCard, { type BookCardData } from "../../components/common/BookCard";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchAdminBooks } from "../../features/adminBooks/adminBooksSlice";
import type { ApiBook } from "../../utils/apiMappers";
import { normalizeText } from "../../utils/textNormalize";

const DRAFT_KEY = "admin_flash_sale_create_draft";
const ITEMS_PER_PAGE = 12;

type StoredDraft = {
  selectedBookIds?: string[];
  itemConfigByBookId?: Record<
    string,
    {
      flash_price: string;
      flash_stock: string;
      purchase_limit: string;
      afterStatus?: "restore";
    }
  >;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readDraft(): StoredDraft {
  if (!canUseStorage()) return {};
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    return (JSON.parse(raw) ?? {}) as StoredDraft;
  } catch {
    return {};
  }
}

function writeDraft(next: StoredDraft) {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function parsePriceInput(value: string): number | undefined {
  const digitsOnly = value.replace(/[\D]/g, "");
  if (!digitsOnly) return undefined;
  const parsed = Number(digitsOnly);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizePriceRange(
  min?: number,
  max?: number,
): { min?: number; max?: number } {
  if (min === undefined || max === undefined) return { min, max };
  if (min <= max) return { min, max };
  return { min: max, max: min };
}

function mapBook(book: ApiBook): BookCardData {
  const sellingPrice = Number(book.selling_price || 0);
  const originalPrice = Number(book.original_price || 0);
  return {
    id: String(book.id),
    title: String(book.title || ""),
    author: String(book.author_name || ""),
    categoryName: String(book.category_name || ""),
    price: formatCurrency(sellingPrice),
    unitPrice: sellingPrice,
    oldPrice:
      originalPrice > sellingPrice ? formatCurrency(originalPrice) : undefined,
    coverSrc: String(book.cover_image || ""),
  };
}

export default function AdminFlashSaleSelectBooksPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { items: books, loading } = useAppSelector((s) => s.adminBooks);

  useEffect(() => {
    void dispatch(fetchAdminBooks());
  }, [dispatch]);

  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const author = searchParams.get("author") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const sort = searchParams.get("sort") || "";
  const page = Number(searchParams.get("page") || "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  const updateSearchParams = (
    updates: Record<string, string | null>,
    resetPage = false,
  ) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  };

  const categories = useMemo(() => {
    return Array.from(
      new Set(books.map((book) => String(book.category_name || "").trim())),
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "vi"));
  }, [books]);

  const topAuthors = useMemo(() => {
    const countByAuthor = books.reduce<Record<string, number>>((acc, book) => {
      const name = String(book.author_name || "").trim();
      if (!name) return acc;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(countByAuthor)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
      .slice(0, 10)
      .map(([name]) => name);
  }, [books]);

  const filteredBooks = useMemo(() => {
    let result = books;
    const { min, max } = normalizePriceRange(
      parsePriceInput(minPrice),
      parsePriceInput(maxPrice),
    );

    if (query.trim()) {
      const q = normalizeText(query);
      result = result.filter(
        (book) =>
          normalizeText(String(book.title || "")).includes(q) ||
          normalizeText(String(book.author_name || "")).includes(q) ||
          normalizeText(String(book.category_name || "")).includes(q),
      );
    }

    if (category.trim()) {
      const normalizedCategory = normalizeText(category.trim());
      result = result.filter(
        (book) =>
          normalizeText(String(book.category_name || "")) ===
          normalizedCategory,
      );
    }

    if (author.trim()) {
      const normalizedAuthor = normalizeText(author.trim());
      result = result.filter(
        (book) =>
          normalizeText(String(book.author_name || "")) === normalizedAuthor,
      );
    }

    if (min !== undefined && !Number.isNaN(min)) {
      result = result.filter((book) => Number(book.selling_price || 0) >= min);
    }

    if (max !== undefined && !Number.isNaN(max)) {
      result = result.filter((book) => Number(book.selling_price || 0) <= max);
    }

    return result;
  }, [books, query, category, author, minPrice, maxPrice]);

  const sortedBooks = useMemo(() => {
    const result = [...filteredBooks];

    switch (sort) {
      case "sold-desc":
        result.sort(
          (a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0),
        );
        break;
      case "newest":
        result.sort((a, b) => Number(b.id) - Number(a.id));
        break;
      case "title-asc":
        result.sort((a, b) =>
          normalizeText(String(a.title || "")).localeCompare(
            normalizeText(String(b.title || "")),
            "vi",
          ),
        );
        break;
      case "title-desc":
        result.sort((a, b) =>
          normalizeText(String(b.title || "")).localeCompare(
            normalizeText(String(a.title || "")),
            "vi",
          ),
        );
        break;
      case "price-asc":
        result.sort(
          (a, b) => Number(a.selling_price || 0) - Number(b.selling_price || 0),
        );
        break;
      case "price-desc":
        result.sort(
          (a, b) => Number(b.selling_price || 0) - Number(a.selling_price || 0),
        );
        break;
      default:
        break;
    }

    return result;
  }, [filteredBooks, sort]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = readDraft();
    return new Set((initial.selectedBookIds ?? []).map(String));
  });

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBooks = sortedBooks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const handleAdd = (book: ApiBook) => {
    const current = readDraft();
    const currentIds = Array.isArray(current.selectedBookIds)
      ? current.selectedBookIds.map(String)
      : [];

    const bookId = String(book.id);
    if (currentIds.includes(bookId)) {
      toast.info("Sách đã có trong danh sách.");
      return;
    }

    const nextIds = [...currentIds, bookId];
    const nextConfig = {
      ...(current.itemConfigByBookId ?? {}),
      [bookId]: current.itemConfigByBookId?.[bookId] ?? {
        flash_price: "",
        flash_stock: "50",
        purchase_limit: "2",
        afterStatus: "restore",
      },
    };

    writeDraft({
      ...current,
      selectedBookIds: nextIds,
      itemConfigByBookId: nextConfig,
    });

    setSelectedIds(new Set(nextIds));

    toast.success("Đã thêm vào chiến dịch.");
  };

  const handleRemove = (bookId: string) => {
    const current = readDraft();
    const currentIds = Array.isArray(current.selectedBookIds)
      ? current.selectedBookIds.map(String)
      : [];
    const nextIds = currentIds.filter((id) => id !== bookId);
    const nextConfig = { ...(current.itemConfigByBookId ?? {}) };
    delete nextConfig[bookId];

    writeDraft({
      ...current,
      selectedBookIds: nextIds,
      itemConfigByBookId: nextConfig,
    });

    setSelectedIds(new Set(nextIds));
    toast.info("Đã bỏ chọn sản phẩm.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-gray-500">
          <Link to="/admin/flash-sale" className="hover:text-teal-800">
            Flash Sale
          </Link>
          <span className="px-2">›</span>
          <Link to="/admin/flash-sale/new" className="hover:text-teal-800">
            Tạo chiến dịch mới
          </Link>
          <span className="px-2">›</span>
          <span className="text-gray-700">Chọn sản phẩm</span>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-teal-900">
              Chọn sản phẩm Flash Sale
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Nhấn “Thêm” ở từng sản phẩm để đưa vào chiến dịch.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/flash-sale/new")}
            className="inline-flex items-center justify-center rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Xong
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <Find
          categories={categories}
          authors={topAuthors}
          selectedCategory={category}
          selectedAuthor={author}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onCategoryChange={(next) =>
            updateSearchParams(
              { category: next || null, author: null, q: null },
              true,
            )
          }
          onAuthorChange={(next) =>
            updateSearchParams(
              { category: null, author: next || null, q: null },
              true,
            )
          }
          onPriceApply={(from, to) => {
            const { min, max } = normalizePriceRange(
              parsePriceInput(from),
              parsePriceInput(to),
            );
            updateSearchParams(
              {
                category: null,
                author: null,
                minPrice: min !== undefined ? String(min) : null,
                maxPrice: max !== undefined ? String(max) : null,
              },
              true,
            );
          }}
        />

        <div className="flex-1">
          <div className="mb-4 flex justify-end">
            <select
              value={sort}
              onChange={(event) =>
                updateSearchParams({ sort: event.target.value || null }, true)
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Sắp xếp mặc định</option>
              <option value="sold-desc">Bán chạy nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="title-asc">Tên A - Z</option>
              <option value="title-desc">Tên Z - A</option>
              <option value="price-asc">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Đang tải dữ liệu...
            </div>
          ) : sortedBooks.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
              Không tìm thấy sách nào
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedBooks.map((book) => {
                  const bookId = String(book.id);
                  const alreadyAdded = selectedIds.has(bookId);
                  return (
                    <BookCard
                      key={bookId}
                      data={mapBook(book)}
                      action={{
                        label: alreadyAdded ? "Bỏ chọn" : "Thêm",
                        onClick: () =>
                          alreadyAdded ? handleRemove(bookId) : handleAdd(book),
                        disabled: false,
                      }}
                    />
                  );
                })}
              </div>

              {sortedBooks.length > ITEMS_PER_PAGE ? (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    current={currentPage}
                    total={sortedBooks.length}
                    pageSize={ITEMS_PER_PAGE}
                    onChange={(nextPage) =>
                      updateSearchParams(
                        { page: nextPage > 1 ? String(nextPage) : null },
                        false,
                      )
                    }
                    showSizeChanger={false}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
