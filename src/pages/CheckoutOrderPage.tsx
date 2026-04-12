import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";
import { useAppSelector } from "../app/hooks";
import { getOrders } from "../services/ordersService";
import type { ApiOrder } from "../utils/apiMappers";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(dateText: string): string {
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

export default function CheckoutOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sessionUserId = useAppSelector((state) => state.session.userId);

  const orderId = useMemo(() => String(id ?? "").trim(), [id]);
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const computedSubtotal = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
  }, [order]);

  useEffect(() => {
    if (!sessionUserId) {
      navigate("/login");
      return;
    }

    if (!orderId) {
      setError("Thiếu mã đơn hàng.");
      setOrder(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError("");

        const orders = await getOrders();
        const found = orders.find((entry) => String(entry.id) === orderId);

        if (!found) {
          throw new Error("Không tìm thấy đơn hàng.");
        }

        if (String(found.user_id) !== String(sessionUserId)) {
          throw new Error("Bạn không có quyền xem đơn hàng này.");
        }

        if (!cancelled) {
          setOrder(found);
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(
            e instanceof Error ? e.message : "Không tải được đơn hàng.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, [navigate, orderId, sessionUserId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-teal-900">
              Chi tiết đơn hàng
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Mã đơn: <span className="font-semibold">LL-{orderId}</span>
            </p>
          </div>

          <Link
            to="/account"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-gray-50"
          >
            Quay lại tài khoản
          </Link>
        </div>

        {loading ? (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Đang tải đơn hàng...
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : order ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-md border border-gray-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="space-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-900">
                      Ngày đặt:
                    </span>{" "}
                    {formatDateTime(order.order_date)}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">
                      Thanh toán:
                    </span>{" "}
                    {order.payment_method}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">
                      Địa chỉ giao hàng:
                    </span>{" "}
                    {order.shipping_address}
                  </div>
                </div>

                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                  {order.order_status}
                </span>
              </div>

              <h2 className="text-lg font-bold text-teal-900">
                Sản phẩm
              </h2>
              <div className="mt-4 space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${order.id}-${item.book_item_id}-${index}`}
                    className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_120px_120px]"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        Mã sách: {item.book_item_id}
                      </p>
                    </div>
                    <div className="text-sm text-gray-700">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Số lượng
                      </p>
                      <p className="mt-1 font-semibold">{item.quantity}</p>
                    </div>
                    <div className="text-sm text-gray-700 md:text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Thành tiền
                      </p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-md border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-bold text-teal-900">Tổng kết</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span>Tạm tính</span>
                  <span className="font-semibold">
                    {formatCurrency(computedSubtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-900">
                  <span className="font-semibold">Tổng thanh toán</span>
                  <span className="text-base font-bold">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
