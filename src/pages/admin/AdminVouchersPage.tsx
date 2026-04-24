import { useEffect, useMemo, useState } from "react";
import { Modal, Table } from "antd";
import { toast } from "react-toastify";
import type { ApiVoucher } from "../../services/vouchersService";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  createAdminVoucher,
  fetchAdminVouchers,
  updateAdminVoucher,
} from "../../features/adminVouchers/adminVouchersSlice";

type VoucherDraft = {
  title: string;
  subtitle: string;
  code: string;
  discount_percent: string;
  voucher_type: "discount" | "freeship";
  applies_to_categories: string;
  valid_from: string;
  valid_to: string;
  condition_text: string;
  terms: string;
};

function getDefaultDraft(voucher?: ApiVoucher | null): VoucherDraft {
  return {
    title: voucher?.title ?? "",
    subtitle: voucher?.subtitle ?? "",
    code: voucher?.code ?? "",
    discount_percent: String(voucher?.discount_percent ?? ""),
    voucher_type: voucher?.voucher_type ?? "discount",
    applies_to_categories: (voucher?.applies_to_categories ?? ["ALL"]).join(
      ",",
    ),
    valid_from: voucher?.valid_from ?? "",
    valid_to: voucher?.valid_to ?? "",
    condition_text: voucher?.condition_text ?? "",
    terms: voucher?.terms ?? "",
  };
}

export default function AdminVouchersPage() {
  const dispatch = useAppDispatch();
  const { items, loading, saving, error } = useAppSelector(
    (state) => state.adminVouchers,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VoucherDraft>(getDefaultDraft());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] =
    useState<VoucherDraft>(getDefaultDraft());

  useEffect(() => {
    void dispatch(fetchAdminVouchers());
  }, [dispatch]);

  const filtered = items;

  const editingVoucher = useMemo(
    () => (editingId ? (items.find((v) => v.id === editingId) ?? null) : null),
    [items, editingId],
  );

  const openEdit = (voucher: ApiVoucher) => {
    setEditingId(voucher.id);
    setDraft(getDefaultDraft(voucher));
  };

  const closeEdit = () => {
    setEditingId(null);
  };

  const normalizeCategoryList = (raw: string): string[] => {
    const parts = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return parts.length ? parts : ["ALL"];
  };

  const handleSaveEdit = async () => {
    if (!editingVoucher) return;

    try {
      await dispatch(
        updateAdminVoucher({
          voucherId: editingVoucher.id,
          payload: {
            title: draft.title.trim(),
            subtitle: draft.subtitle.trim(),
            code: draft.code.trim(),
            discount_percent: Number(draft.discount_percent || 0),
            voucher_type: draft.voucher_type,
            applies_to_categories: normalizeCategoryList(
              draft.applies_to_categories,
            ),
            valid_from: draft.valid_from.trim() || null,
            valid_to: draft.valid_to.trim() || null,
            condition_text: draft.condition_text.trim(),
            terms: draft.terms.trim(),
          },
        }),
      ).unwrap();

      toast.success("Đã lưu mã giảm giá.");
      closeEdit();
    } catch (error_) {
      toast.error(
        typeof error_ === "string" ? error_ : "Không lưu được mã giảm giá.",
      );
    }
  };

  const handleCreate = async () => {
    try {
      await dispatch(
        createAdminVoucher({
          title: createDraft.title.trim(),
          subtitle: createDraft.subtitle.trim(),
          code: createDraft.code.trim(),
          discount_percent: Number(createDraft.discount_percent || 0),
          voucher_type: createDraft.voucher_type,
          applies_to_categories: normalizeCategoryList(
            createDraft.applies_to_categories,
          ),
          valid_from: createDraft.valid_from.trim() || null,
          valid_to: createDraft.valid_to.trim() || null,
          condition_text: createDraft.condition_text.trim(),
          terms: createDraft.terms.trim(),
        }),
      ).unwrap();

      toast.success("Đã tạo mã giảm giá mới.");
      setIsCreateOpen(false);
      setCreateDraft(getDefaultDraft());
    } catch (error_) {
      toast.error(
        typeof error_ === "string" ? error_ : "Không tạo được mã giảm giá.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-teal-900">
            Quản lý mã giảm giá
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Thêm và chỉnh sửa voucher đang áp dụng
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Thêm mã mới
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-500">
            {loading ? "Đang tải..." : `${filtered.length} mã`}
          </div>
        </div>

        <Table
          className="mt-4"
          rowKey={(record) => record.id}
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: "Tiêu đề",
              dataIndex: "title",
              key: "title",
            },
            {
              title: "Code",
              dataIndex: "code",
              key: "code",
              width: 160,
            },
            {
              title: "Loại",
              dataIndex: "voucher_type",
              key: "voucher_type",
              width: 120,
              render: (value: ApiVoucher["voucher_type"]) =>
                value === "freeship" ? "Freeship" : "Discount",
            },
            {
              title: "% giảm",
              dataIndex: "discount_percent",
              key: "discount_percent",
              width: 120,
            },
            {
              title: "Hành động",
              key: "actions",
              width: 140,
              render: (_: unknown, record: ApiVoucher) => (
                <button
                  type="button"
                  onClick={() => openEdit(record)}
                  className="rounded-xl border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                >
                  Chỉnh sửa
                </button>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={<span className="font-bold text-teal-900">Chỉnh sửa mã</span>}
        open={Boolean(editingId)}
        onCancel={closeEdit}
        onOk={() => void handleSaveEdit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnClose
      >
        <VoucherForm draft={draft} onChange={setDraft} />
      </Modal>

      <Modal
        title={<span className="font-bold text-teal-900">Thêm mã mới</span>}
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnClose
      >
        <VoucherForm draft={createDraft} onChange={setCreateDraft} />
      </Modal>
    </div>
  );
}

function VoucherForm({
  draft,
  onChange,
}: {
  draft: VoucherDraft;
  onChange: (
    next: VoucherDraft | ((prev: VoucherDraft) => VoucherDraft),
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tiêu đề
          </div>
          <input
            value={draft.title}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, title: event.target.value }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Phụ đề
          </div>
          <input
            value={draft.subtitle}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, subtitle: event.target.value }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Code
          </div>
          <input
            value={draft.code}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, code: event.target.value }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            % giảm
          </div>
          <input
            inputMode="numeric"
            value={draft.discount_percent}
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                discount_percent: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Loại
          </div>
          <select
            value={draft.voucher_type}
            onChange={(event) =>
              onChange((prev) => ({
                ...prev,
                voucher_type: event.target
                  .value as VoucherDraft["voucher_type"],
              }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          >
            <option value="discount">discount</option>
            <option value="freeship">freeship</option>
          </select>
        </label>
      </div>

      <label className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Áp dụng thể loại
        </div>
        <input
          value={draft.applies_to_categories}
          onChange={(event) =>
            onChange((prev) => ({
              ...prev,
              applies_to_categories: event.target.value,
            }))
          }
          placeholder="ALL hoặc Fiction,Science,..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Hiệu lực từ
          </div>
          <input
            value={draft.valid_from}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, valid_from: event.target.value }))
            }
            placeholder="2026-04-17T00:00:00Z"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <label className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Hiệu lực đến
          </div>
          <input
            value={draft.valid_to}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, valid_to: event.target.value }))
            }
            placeholder="2026-04-30T23:59:59Z"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
      </div>

      <label className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Điều kiện
        </div>
        <input
          value={draft.condition_text}
          onChange={(event) =>
            onChange((prev) => ({
              ...prev,
              condition_text: event.target.value,
            }))
          }
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>

      <label className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Điều khoản
        </div>
        <textarea
          rows={3}
          value={draft.terms}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, terms: event.target.value }))
          }
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>
    </div>
  );
}
