import { useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layouts/Header";
import Footer from "../components/layouts/Footer";

type CallbackState = "success" | "failed" | "invalid_signature";

function getStateFromStatus(rawStatus: string): CallbackState {
  if (rawStatus === "success") return "success";
  if (rawStatus === "invalid_signature") return "invalid_signature";
  return "failed";
}

export default function VnpayCallbackPage() {
  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );

  const orderId = searchParams.get("order_id") ?? "";
  const responseCode = searchParams.get("response_code") ?? "";
  const status = getStateFromStatus(searchParams.get("status") ?? "");
  const message = searchParams.get("message") ?? "";

  const heading =
    status === "success"
      ? "Thanh toán VNPay thành công"
      : status === "invalid_signature"
        ? "Không xác thực được giao dịch"
        : "Thanh toán VNPay chưa thành công";

  const description =
    message ||
    (status === "success"
      ? "Đơn hàng của bạn đã được thanh toán. Hệ thống đang xử lý giao hàng."
      : "Bạn có thể thử thanh toán lại hoặc liên hệ hỗ trợ nếu đã bị trừ tiền.");

  const boxClassName =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className={`rounded-xl border p-6 shadow-sm ${boxClassName}`}>
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="mt-3 text-sm leading-6">{description}</p>

          <div className="mt-5 space-y-2 rounded-lg bg-white/70 p-4 text-sm text-gray-700">
            <p>
              <span className="font-semibold">Mã đơn hàng:</span>{" "}
              {orderId || "Không xác định"}
            </p>
            <p>
              <span className="font-semibold">Mã phản hồi VNPay:</span>{" "}
              {responseCode || "Không có"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/account?source=vnpay&status=${encodeURIComponent(status)}&order_id=${encodeURIComponent(orderId)}`}
              className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Xem đơn hàng của tôi
            </Link>
            <Link
              to="/"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Về trang chủ
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
