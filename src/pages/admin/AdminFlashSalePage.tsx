import { useEffect, useMemo, useState } from "react";
import { Modal, Select, Table } from "antd";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import type { ApiBook } from "../../utils/apiMappers";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { normalizeText } from "../../utils/textNormalize";
import { fetchAdminBooks } from "../../features/adminBooks/adminBooksSlice";
import {
  addFlashSaleCampaignItem,
  deleteFlashSaleCampaign,
  fetchCampaignItems,
  fetchCampaigns,
} from "../../features/flashSaleAdmin/flashSaleAdminSlice";
import type {
  FlashSaleCampaign,
  FlashSaleCampaignItem,
} from "../../services/flashSaleAdminService";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function getCampaignStatus(
  campaign: FlashSaleCampaign,
): "UPCOMING" | "ACTIVE" | "ENDED" {
  const now = Date.now();
  const start = new Date(campaign.starts_at).getTime();
  const end = new Date(campaign.ends_at).getTime();
  if (!Number.isNaN(start) && now < start) return "UPCOMING";
  if (!Number.isNaN(end) && now > end) return "ENDED";
  return "ACTIVE";
}

type ItemDraft = {
  bookId: string;
  flash_price: string;
  flash_stock: string;
  purchase_limit: string;
};

export default function AdminFlashSalePage() {
  const dispatch = useAppDispatch();
  const location = useLocation();

  const {
    campaigns,
    itemsByCampaignId,
    loading: flashLoading,
    saving,
    error,
  } = useAppSelector((state) => state.flashSaleAdmin);

  const { items: books, loading: booksLoading } = useAppSelector(
    (state) => state.adminBooks,
  );

  const loading = flashLoading || booksLoading;

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const campaignQuery = useMemo(() => {
    return new URLSearchParams(location.search).get("q") ?? "";
  }, [location.search]);
  const campaignFromUrl = useMemo(() => {
    return new URLSearchParams(location.search).get("campaign") ?? "";
  }, [location.search]);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    bookId: "",
    flash_price: "",
    flash_stock: "",
    purchase_limit: "1",
  });

  useEffect(() => {
    void dispatch(fetchCampaigns());
    void dispatch(fetchAdminBooks());
  }, [dispatch]);

  const filteredCampaigns = useMemo(() => {
    const q = normalizeText(campaignQuery);
    if (!q) return campaigns;
    return campaigns.filter((campaign) =>
      normalizeText(campaign.name).includes(q),
    );
  }, [campaignQuery, campaigns]);

  const campaignIdSet = useMemo(() => {
    return new Set(campaigns.map((campaign) => campaign.id));
  }, [campaigns]);

  const effectiveCampaignId = useMemo(() => {
    const candidates = [
      selectedCampaignId,
      campaignFromUrl,
      filteredCampaigns[0]?.id,
      campaigns[0]?.id,
    ];

    return (
      candidates.find(
        (candidate) =>
          Boolean(candidate) && campaignIdSet.has(String(candidate)),
      ) ?? ""
    );
  }, [
    campaignFromUrl,
    campaignIdSet,
    campaigns,
    filteredCampaigns,
    selectedCampaignId,
  ]);

  useEffect(() => {
    if (!effectiveCampaignId) return;
    void dispatch(fetchCampaignItems(effectiveCampaignId));
  }, [dispatch, effectiveCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === effectiveCampaignId) ?? null,
    [campaigns, effectiveCampaignId],
  );

  const campaignItems = useMemo<FlashSaleCampaignItem[]>(() => {
    if (!effectiveCampaignId) return [];
    return itemsByCampaignId[effectiveCampaignId] ?? [];
  }, [itemsByCampaignId, effectiveCampaignId]);

  const bookById = useMemo(() => {
    return new Map<string, ApiBook>(
      books.map((book) => [String(book.id), book]),
    );
  }, [books]);

  const handleAddItem = async () => {
    if (!selectedCampaign) return;

    const book = bookById.get(itemDraft.bookId) ?? null;
    if (!book) {
      toast.error("Vui lòng chọn sách.");
      return;
    }

    const flashPrice = Number(itemDraft.flash_price || 0);
    const flashStock = Number(itemDraft.flash_stock || 0);
    const purchaseLimit = Math.max(1, Number(itemDraft.purchase_limit || 1));

    if (!flashPrice || flashPrice >= book.selling_price) {
      toast.error("Giá flash sale phải thấp hơn giá bán hiện tại.");
      return;
    }

    if (!flashStock || flashStock < 1) {
      toast.error("Tồn kho flash sale phải lớn hơn 0.");
      return;
    }

    if (typeof book.total_stock === "number" && flashStock > book.total_stock) {
      toast.error("Tồn kho flash sale không được vượt quá tồn kho hiện tại.");
      return;
    }

    try {
      await dispatch(
        addFlashSaleCampaignItem({
          campaignId: selectedCampaign.id,
          payload: {
            book_id: (() => {
              const numeric = Number(book.id);
              return Number.isFinite(numeric) ? numeric : book.id;
            })(),
            flash_price: flashPrice,
            flash_stock: flashStock,
            purchase_limit: purchaseLimit,
          },
        }),
      ).unwrap();

      setIsAddItemOpen(false);
      setItemDraft({
        bookId: "",
        flash_price: "",
        flash_stock: "",
        purchase_limit: "1",
      });
      toast.success("Đã thêm sách vào campaign.");
    } catch (error_) {
      toast.error(
        typeof error_ === "string"
          ? error_
          : "Không thêm được sách vào flash sale.",
      );
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xoá chiến dịch "${selectedCampaign.name}" không?`,
    );
    if (!confirmed) return;

    try {
      await dispatch(deleteFlashSaleCampaign(selectedCampaign.id)).unwrap();
      setSelectedCampaignId("");
      toast.success("Đã xoá chiến dịch.");
    } catch (error_) {
      toast.error(
        typeof error_ === "string" ? error_ : "Không xoá được chiến dịch.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-teal-900">Flash sale</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tạo Campaign theo khung giờ, thêm sách và thiết lập giá/tồn kho/giới
            hạn mua.
          </p>
        </div>

        <Link
          to="/admin/flash-sale/new"
          className="inline-flex items-center justify-center rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Tạo chiến dịch
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[22rem,1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-teal-900">Chiến dịch</h2>
            <div className="text-sm font-semibold text-gray-500">
              {filteredCampaigns.length}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filteredCampaigns.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                Không có campaign phù hợp.
              </p>
            ) : (
              filteredCampaigns.map((campaign) => {
                const status = getCampaignStatus(campaign);
                const isActive = campaign.id === effectiveCampaignId;
                const statusColor =
                  status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-800"
                    : status === "UPCOMING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700";

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={[
                      "w-full rounded-2xl border px-3 py-3 text-left transition",
                      isActive
                        ? "border-teal-700 bg-teal-50"
                        : "border-gray-200 hover:border-teal-200",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-teal-900">
                          {campaign.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {campaign.starts_at} → {campaign.ends_at}
                        </div>
                      </div>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[11px] font-semibold",
                          statusColor,
                        ].join(" ")}
                      >
                        {status === "ACTIVE"
                          ? "Đang diễn ra"
                          : status === "UPCOMING"
                            ? "Sắp diễn ra"
                            : "Đã kết thúc"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-teal-900">
                Sản phẩm trong campaign
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedCampaign
                  ? selectedCampaign.name
                  : "Chọn một campaign để quản lý"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedCampaign || saving}
                onClick={() => void handleDeleteCampaign()}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Xoá chiến dịch
              </button>
              <button
                type="button"
                disabled={!selectedCampaign}
                onClick={() => setIsAddItemOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Thêm sách
              </button>
            </div>
          </div>

          <Table
            className="mt-4"
            rowKey={(record) => record.id}
            loading={loading}
            dataSource={campaignItems}
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: "Sách",
                dataIndex: "book_id",
                key: "book_id",
                render: (value: string) => {
                  const book = bookById.get(String(value));
                  return book ? (
                    <div>
                      <div className="font-semibold text-teal-900">
                        {book.title}
                      </div>
                      <div className="text-xs text-gray-500">ID: {book.id}</div>
                    </div>
                  ) : (
                    <span className="text-gray-500">#{value}</span>
                  );
                },
              },
              {
                title: "Giá flash",
                dataIndex: "flash_price",
                key: "flash_price",
                width: 160,
                render: (value: number) => formatCurrency(value),
              },
              {
                title: "Tồn flash",
                dataIndex: "flash_stock",
                key: "flash_stock",
                width: 120,
              },
              {
                title: "Giới hạn",
                dataIndex: "purchase_limit",
                key: "purchase_limit",
                width: 120,
              },
            ]}
          />
        </div>
      </div>

      <Modal
        title={
          <span className="font-bold text-teal-900">
            Thêm sách vào Campaign
          </span>
        }
        open={isAddItemOpen}
        onCancel={() => setIsAddItemOpen(false)}
        onOk={() => void handleAddItem()}
        okText="Thêm"
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
      >
        <div className="space-y-3">
          <label className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Chọn sách
            </div>
            <Select
              value={itemDraft.bookId || undefined}
              onChange={(value) =>
                setItemDraft((prev) => ({
                  ...prev,
                  bookId: value ? String(value) : "",
                }))
              }
              placeholder="Tìm & chọn sách..."
              className="w-full"
              showSearch
              allowClear
              optionFilterProp="label"
              filterOption={(input, option) =>
                normalizeText(String(option?.label ?? "")).includes(
                  normalizeText(input),
                )
              }
              options={books.map((book) => ({
                value: String(book.id),
                label: `${book.title} (#${book.id})`,
              }))}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Giá Flash Sale
              </div>
              <input
                inputMode="numeric"
                value={itemDraft.flash_price}
                onChange={(event) =>
                  setItemDraft((prev) => ({
                    ...prev,
                    flash_price: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tồn kho Flash
              </div>
              <input
                inputMode="numeric"
                value={itemDraft.flash_stock}
                onChange={(event) =>
                  setItemDraft((prev) => ({
                    ...prev,
                    flash_stock: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Giới hạn mua
              </div>
              <input
                inputMode="numeric"
                value={itemDraft.purchase_limit}
                onChange={(event) =>
                  setItemDraft((prev) => ({
                    ...prev,
                    purchase_limit: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </label>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Bắt buộc nhập: Giá flash sale (thấp hơn giá bán), Tồn flash sale,
            Giới hạn mua/user.
          </div>
        </div>
      </Modal>
    </div>
  );
}
