import { useEffect, useMemo, useState } from "react";
import { DatePicker, Segmented, Table } from "antd";
import type { ApiOrder } from "../../utils/apiMappers";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchAdminOrders } from "../../features/adminStats/adminStatsSlice";

type RangePreset = "7d" | "30d";

type RevenuePoint = {
  dateLabel: string;
  revenue: number;
  orderCount: number;
};

type BookRevenueRow = {
  key: string;
  title: string;
  quantity: number;
  revenue: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isApprovedByStaff(order: ApiOrder): boolean {
  const normalized = String(order.order_status || "").trim().toLowerCase();
  return normalized !== "cho duyet";
}

export default function AdminStatsPage() {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state) => state.adminStats);

  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);

  useEffect(() => {
    void dispatch(fetchAdminOrders());
  }, [dispatch]);

  const approvedOrders = useMemo(
    () => orders.filter((order) => isApprovedByStaff(order)),
    [orders],
  );

  const todayApprovedOrders = useMemo(() => {
    const today = new Date();
    return approvedOrders.filter((order) => {
      const orderDate = new Date(order.order_date);
      return (
        !Number.isNaN(orderDate.getTime()) && isSameLocalDate(orderDate, today)
      );
    });
  }, [approvedOrders]);

  const effectiveRange = useMemo(() => {
    const [from, to] = customRange;
    if (from && to) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (rangePreset === "7d" ? 6 : 29));

    return { start, end };
  }, [customRange, rangePreset]);

  const revenuePoints = useMemo<RevenuePoint[]>(() => {
    const { start, end } = effectiveRange;
    const buckets = new Map<string, { revenue: number; orderCount: number }>();

    for (const order of approvedOrders) {
      const d = new Date(order.order_date);
      if (Number.isNaN(d.getTime())) continue;
      if (d < start || d > end) continue;

      const label = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}`;

      const current = buckets.get(label) ?? { revenue: 0, orderCount: 0 };
      current.revenue += Number(order.total_amount || 0);
      current.orderCount += 1;
      buckets.set(label, current);
    }

    const points = Array.from(buckets.entries()).map(([dateLabel, value]) => ({
      dateLabel,
      revenue: value.revenue,
      orderCount: value.orderCount,
    }));

    return points.sort((a, b) => {
      const [ad, am] = a.dateLabel.split("/").map((v) => Number(v));
      const [bd, bm] = b.dateLabel.split("/").map((v) => Number(v));
      if (am !== bm) return am - bm;
      return ad - bd;
    });
  }, [approvedOrders, effectiveRange]);

  const bookRevenue = useMemo<BookRevenueRow[]>(() => {
    const totals = new Map<
      string,
      { title: string; quantity: number; revenue: number }
    >();

    for (const order of approvedOrders) {
      for (const item of order.items) {
        const key = String(item.book_item_id || item.title);
        const current = totals.get(key) ?? {
          title: item.title,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += Number(item.quantity || 0);
        current.revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
        totals.set(key, current);
      }
    }

    return Array.from(totals.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [approvedOrders]);

  const totalRevenueInRange = useMemo(
    () => revenuePoints.reduce((sum, point) => sum + point.revenue, 0),
    [revenuePoints],
  );

  const totalOrdersInRange = useMemo(
    () => revenuePoints.reduce((sum, point) => sum + point.orderCount, 0),
    [revenuePoints],
  );

  const maxRevenuePoint = useMemo(
    () => revenuePoints.reduce((max, p) => Math.max(max, p.revenue), 0),
    [revenuePoints],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-teal-900">Thống kê</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tổng quan đơn hàng & doanh thu của Sách Xanh
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Segmented
            value={rangePreset}
            onChange={(value) => {
              setCustomRange([null, null]);
              setRangePreset(value as RangePreset);
            }}
            options={[
              { label: "7 ngày", value: "7d" },
              { label: "30 ngày", value: "30d" },
            ]}
          />
          <DatePicker.RangePicker
            onChange={(range) => {
              if (!range || range.length !== 2) {
                setCustomRange([null, null]);
                return;
              }
              setCustomRange([
                range[0] ? range[0].toDate() : null,
                range[1] ? range[1].toDate() : null,
              ]);
            }}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Đơn hàng hôm nay (đã duyệt)
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-900">
            {todayApprovedOrders.length}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Không tính đơn trạng thái "Chờ duyệt"
          </p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Doanh thu trong khoảng</p>
          <p className="mt-2 text-3xl font-bold text-teal-900">
            {formatCurrency(totalRevenueInRange)}
          </p>
          <p className="mt-1 text-sm text-gray-400">{totalOrdersInRange} đơn hàng</p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Trung bình / đơn</p>
          <p className="mt-2 text-3xl font-bold text-teal-900">
            {formatCurrency(
              totalOrdersInRange
                ? Math.round(totalRevenueInRange / totalOrdersInRange)
                : 0,
            )}
          </p>
          <p className="mt-1 text-sm text-gray-400">Chỉ tính đơn đã duyệt</p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-teal-900">Doanh thu theo thời gian</h2>
          <div className="text-sm text-gray-500">
            {effectiveRange.start.toLocaleDateString("vi-VN")} -{" "}
            {effectiveRange.end.toLocaleDateString("vi-VN")}
          </div>
        </div>

        {revenuePoints.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Chưa có dữ liệu doanh thu trong khoảng thời gian này.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {revenuePoints.map((point) => {
              const ratio = maxRevenuePoint
                ? Math.round((point.revenue / maxRevenuePoint) * 100)
                : 0;
              return (
                <div
                  key={point.dateLabel}
                  className="grid grid-cols-[4.5rem,1fr,10rem] items-center gap-3"
                >
                  <div className="text-sm font-semibold text-gray-600">
                    {point.dateLabel}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <div className="text-right text-sm font-semibold text-teal-900">
                    {formatCurrency(point.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-teal-900">Top sách theo doanh thu</h2>
        <Table
          className="mt-4"
          loading={loading}
          pagination={false}
          dataSource={bookRevenue}
          columns={[
            {
              title: "Sách",
              dataIndex: "title",
              key: "title",
            },
            {
              title: "Số lượng",
              dataIndex: "quantity",
              key: "quantity",
              width: 120,
            },
            {
              title: "Doanh thu",
              dataIndex: "revenue",
              key: "revenue",
              render: (value: number) => formatCurrency(value),
              width: 180,
            },
          ]}
        />
      </section>
    </div>
  );
}
