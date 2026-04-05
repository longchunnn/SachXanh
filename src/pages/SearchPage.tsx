import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pagination } from "antd";
import axiosClient from "../services/axiosClient";
import { normalizeText } from "../utils/textNormalize";
import { type BookCardData } from "../components/common/BookCard";
import BookCard from "../components/common/BookCard";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import Find from "../components/common/Find";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setDebouncedQuery,
  syncFromParams,
} from "../store/slices/searchUiSlice";
import { dedupeBooksById } from "../utils/books";

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

const ITEMS_PER_PAGE = 12;

function parsePriceInput(value: string): number | undefined {
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) return undefined;
  const parsed = Number(digitsOnly);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizePriceRange(
  min?: number,
  max?: number,
): { min?: number; max?: number } {
  if (min === undefined || max === undefined) {
    return { min, max };
  }

  if (min <= max) {
    return { min, max };
  }

  return { min: max, max: min };
}

export default function SearchPage() {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    query,
    category,
    author,
    minPrice,
    maxPrice,
    sort,
    page,
    debouncedQuery,
  } = useAppSelector((state) => state.searchUi);

  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  const [books, setBooks] = useState<DbBook[]>([]);
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryValue = searchParams.get("q") || "";
    const categoryValue = searchParams.get("category") || "";
    const authorValue = searchParams.get("author") || "";
    const minPriceValue = searchParams.get("minPrice") || "";
    const maxPriceValue = searchParams.get("maxPrice") || "";
    const sortValue = searchParams.get("sort") || "";
    const pageValue = Number(searchParams.get("page") || "1");

    dispatch(
      syncFromParams({
        query: queryValue,
        category: categoryValue,
        author: authorValue,
        minPrice: minPriceValue,
        maxPrice: maxPriceValue,
        sort: sortValue,
        page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
      }),
    );
  }, [dispatch, searchParams]);

  // Load all books on mount
  useEffect(() => {
    let isMounted = true;

    async function loadBooks() {
      try {
        setLoading(true);
        setError("");
        const [booksResponse, reviewsResponse] = await Promise.all([
          axiosClient.get("/books"),
          axiosClient.get("/reviews"),
        ]);
        if (!isMounted) return;
        setBooks(
          Array.isArray(booksResponse)
            ? dedupeBooksById(booksResponse as DbBook[])
            : [],
        );
        setReviews(
          Array.isArray(reviewsResponse) ? (reviewsResponse as DbReview[]) : [],
        );
      } catch {
        if (isMounted) {
          setError(
            "Không tải được dữ liệu từ db.json. Vui lòng kiểm tra json-server.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBooks();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Debounce search query - 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setDebouncedQuery(query));
    }, 500);

    return () => clearTimeout(timer);
  }, [dispatch, query]);

  const categories = useMemo(() => {
    return Array.from(new Set(books.map((book) => book.category_name))).sort(
      (a, b) => a.localeCompare(b, "vi"),
    );
  }, [books]);

  const topAuthors = useMemo(() => {
    const countByAuthor = books.reduce<Record<string, number>>((acc, book) => {
      acc[book.author_name] = (acc[book.author_name] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(countByAuthor)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
      .slice(0, 10)
      .map(([author]) => author);
  }, [books]);

  const updateSearchParams = (
    updates: Record<string, string | null>,
    resetPage = false,
  ) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    if (resetPage) {
      nextParams.delete("page");
    }

    setSearchParams(nextParams);
  };

  // Filter and search logic
  const filteredBooks = useMemo(() => {
    let result = books;
    const { min: minPriceValue, max: maxPriceValue } = normalizePriceRange(
      parsePriceInput(minPrice),
      parsePriceInput(maxPrice),
    );

    // Search by title and author (case and accent insensitive)
    if (debouncedQuery) {
      const q = normalizeText(debouncedQuery);
      result = result.filter(
        (book) =>
          normalizeText(book.title).includes(q) ||
          normalizeText(book.author_name).includes(q) ||
          normalizeText(book.category_name).includes(q),
      );
    }

    if (category) {
      const normalizedCategory = normalizeText(category.trim());
      result = result.filter(
        (book) => normalizeText(book.category_name) === normalizedCategory,
      );
    }

    if (author) {
      const normalizedAuthor = normalizeText(author.trim());
      result = result.filter(
        (book) => normalizeText(book.author_name) === normalizedAuthor,
      );
    }

    if (minPriceValue !== undefined && !Number.isNaN(minPriceValue)) {
      result = result.filter((book) => book.selling_price >= minPriceValue);
    }

    if (maxPriceValue !== undefined && !Number.isNaN(maxPriceValue)) {
      result = result.filter((book) => book.selling_price <= maxPriceValue);
    }

    return result;
  }, [books, debouncedQuery, category, author, minPrice, maxPrice]);

  const sortedBooks = useMemo(() => {
    const result = [...filteredBooks];

    switch (sort) {
      case "sold-desc":
        result.sort((a, b) => b.sold_count - a.sold_count);
        break;
      case "newest":
        result.sort((a, b) => Number(b.id) - Number(a.id));
        break;
      case "title-asc":
        result.sort((a, b) =>
          normalizeText(a.title).localeCompare(normalizeText(b.title), "vi"),
        );
        break;
      case "title-desc":
        result.sort((a, b) =>
          normalizeText(b.title).localeCompare(normalizeText(a.title), "vi"),
        );
        break;
      case "price-asc":
        result.sort((a, b) => a.selling_price - b.selling_price);
        break;
      case "price-desc":
        result.sort((a, b) => b.selling_price - a.selling_price);
        break;
      default:
        break;
    }

    return result;
  }, [filteredBooks, sort]);

  const activeResultLabel = useMemo(() => {
    if (debouncedQuery) {
      return `"${debouncedQuery}"`;
    }

    if (category) {
      return `thể loại "${category}"`;
    }

    if (author) {
      return `tác giả "${author}"`;
    }

    if (minPrice || maxPrice) {
      const { min, max } = normalizePriceRange(
        parsePriceInput(minPrice),
        parsePriceInput(maxPrice),
      );
      if (min !== undefined && max !== undefined) {
        return `khoảng giá từ ${formatCurrency(min)} đến ${formatCurrency(max)}`;
      }
      if (min !== undefined) {
        return `giá từ ${formatCurrency(min)} trở lên`;
      }
      if (max !== undefined) {
        return `giá đến ${formatCurrency(max)}`;
      }
    }

    switch (sort) {
      case "sold-desc":
        return "Sách bán chạy nhất";
      case "newest":
        return "Sách mới nhất";
      case "title-asc":
        return "Tên A - Z";
      case "title-desc":
        return "Tên Z - A";
      case "price-asc":
        return "Giá tăng dần";
      case "price-desc":
        return "Giá giảm dần";
      default:
        return "";
    }
  }, [debouncedQuery, category, author, minPrice, maxPrice, sort]);

  // Pagination
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBooks = sortedBooks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  return (
    <>
      <Header />
      <main className="bg-gray-50 min-h-screen py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Search title */}
          {activeResultLabel && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-teal-800">
                Kết quả tìm kiếm cho:{" "}
                <span className="italic">{activeResultLabel}</span>
              </h1>
              <p className="text-gray-600 text-sm mt-2">
                Tìm thấy {sortedBooks.length} kết quả
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-6">
            <Find
              categories={categories}
              authors={topAuthors}
              selectedCategory={category}
              selectedAuthor={author}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onCategoryChange={(category) =>
                updateSearchParams(
                  {
                    category: category || null,
                    author: null,
                    q: null,
                  },
                  true,
                )
              }
              onAuthorChange={(author) =>
                updateSearchParams(
                  {
                    category: null,
                    author: author || null,
                    q: null,
                  },
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
                  onChange={(e) =>
                    updateSearchParams({ sort: e.target.value || null }, true)
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
                <div className="text-center py-12">
                  <p className="text-gray-500">Đang tải dữ liệu...</p>
                </div>
              ) : sortedBooks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500 text-lg">
                    Không tìm thấy sách nào
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {paginatedBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        data={mapBook(book, ratingMap.get(String(book.id)))}
                      />
                    ))}
                  </div>

                  {sortedBooks.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center mt-8">
                      <Pagination
                        current={currentPage}
                        total={sortedBooks.length}
                        pageSize={ITEMS_PER_PAGE}
                        onChange={(page) =>
                          updateSearchParams(
                            { page: page > 1 ? String(page) : null },
                            false,
                          )
                        }
                        showSizeChanger={false}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
