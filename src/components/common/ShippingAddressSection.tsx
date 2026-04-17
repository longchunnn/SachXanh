type ShippingField =
  | "shippingFullName"
  | "shippingPhone"
  | "shippingAddressLine"
  | "shippingProvince"
  | "shippingDistrict"
  | "shippingWard";

type ShippingForm = Record<ShippingField, string>;

type ShippingFormErrors = Partial<Record<ShippingField, string>>;

type SavedAddress = {
  id: string;
  isDefault?: boolean;
  fullName: string;
  phone: string;
  addressLine: string;
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
};

type LocationOption = {
  code: string;
  name: string;
};

type ShippingAddressSectionProps = {
  form: ShippingForm;
  formErrors: ShippingFormErrors;
  isProfileSaved: boolean;
  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;
  provinces: LocationOption[];
  districts: LocationOption[];
  wards: LocationOption[];
  onAddNewAddress: () => void;
  onSelectSavedAddress: (addressId: string) => void;
  onDeleteSavedAddress: (addressId: string) => void;
  onFormFieldChange: (field: ShippingField, value: string) => void;
  onShippingProvinceChange: (provinceCode: string) => void;
  onShippingDistrictChange: (districtCode: string) => void;
  isAddressFormVisible: boolean;
  showHeader?: boolean;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  showAddressForm?: boolean;
};

export default function ShippingAddressSection({
  form,
  formErrors,
  isProfileSaved,
  savedAddresses,
  selectedAddressId,
  provinces,
  districts,
  wards,
  onAddNewAddress,
  onSelectSavedAddress,
  onDeleteSavedAddress,
  onFormFieldChange,
  onShippingProvinceChange,
  onShippingDistrictChange,
  isAddressFormVisible,
  showHeader = true,
  showAddButton = true,
  showDeleteButton = true,
  showAddressForm = true,
}: ShippingAddressSectionProps) {
  const hasShippingErrors = Boolean(
    formErrors.shippingFullName ||
    formErrors.shippingPhone ||
    formErrors.shippingAddressLine ||
    formErrors.shippingProvince ||
    formErrors.shippingDistrict ||
    formErrors.shippingWard,
  );

  const shouldShowForm = isAddressFormVisible || hasShippingErrors;

  return (
    <div className="border border-gray-200 bg-gray-50 p-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">
            Địa chỉ giao hàng
          </h3>
          {showAddButton ? (
            <button
              type="button"
              onClick={onAddNewAddress}
              className="border border-teal-700 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              + Thêm địa chỉ
            </button>
          ) : null}
        </div>
      ) : null}

      {!showHeader && showAddButton ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onAddNewAddress}
            className="border border-teal-700 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            + Thêm địa chỉ
          </button>
        </div>
      ) : null}

      {savedAddresses.length > 0 ? (
        <div className="mt-3 space-y-2 border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Địa chỉ đã lưu
          </p>
          {savedAddresses.map((address) => (
            <div
              key={address.id}
              className="flex items-start justify-between gap-3 text-sm text-gray-700"
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="saved-address"
                  checked={selectedAddressId === address.id}
                  onChange={() => onSelectSavedAddress(address.id)}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span>
                  <strong>{address.fullName}</strong> - {address.phone}
                  {address.isDefault ? (
                    <span className="ml-2 inline-flex bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                      Mặc định
                    </span>
                  ) : null}
                  <br />
                  {address.addressLine}
                  {address.wardName ? `, ${address.wardName}` : ""}
                  {address.districtName ? `, ${address.districtName}` : ""}
                  {address.provinceName ? `, ${address.provinceName}` : ""}
                </span>
              </label>

              {showDeleteButton ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteSavedAddress(address.id)}
                    className="border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Xoá
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showAddressForm && shouldShowForm ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-gray-700">Người nhận</span>
            <input
              value={form.shippingFullName}
              onChange={(event) =>
                onFormFieldChange("shippingFullName", event.target.value)
              }
              readOnly={isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingFullName
                  ? "border-red-400"
                  : "border-gray-200"
              } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
            />
            {formErrors.shippingFullName ? (
              <p className="text-xs text-red-600">
                {formErrors.shippingFullName}
              </p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-gray-700">
              Số điện thoại nhận hàng
            </span>
            <input
              value={form.shippingPhone}
              onChange={(event) =>
                onFormFieldChange("shippingPhone", event.target.value)
              }
              readOnly={isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingPhone ? "border-red-400" : "border-gray-200"
              } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
            />
            {formErrors.shippingPhone ? (
              <p className="text-xs text-red-600">{formErrors.shippingPhone}</p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-semibold text-gray-700">
              Địa chỉ chi tiết
            </span>
            <input
              value={form.shippingAddressLine}
              onChange={(event) =>
                onFormFieldChange("shippingAddressLine", event.target.value)
              }
              readOnly={isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingAddressLine
                  ? "border-red-400"
                  : "border-gray-200"
              } ${isProfileSaved ? "bg-gray-50 text-gray-600" : ""}`}
            />
            {formErrors.shippingAddressLine ? (
              <p className="text-xs text-red-600">
                {formErrors.shippingAddressLine}
              </p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-gray-700">
              Tỉnh / Thành phố
            </span>
            <select
              value={form.shippingProvince}
              onChange={(event) => onShippingProvinceChange(event.target.value)}
              disabled={isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingProvince
                  ? "border-red-400"
                  : "border-gray-200"
              } ${isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
            >
              <option value="">Chọn Tỉnh / Thành phố</option>
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
            {formErrors.shippingProvince ? (
              <p className="text-xs text-red-600">
                {formErrors.shippingProvince}
              </p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-gray-700">Quận / Huyện</span>
            <select
              value={form.shippingDistrict}
              onChange={(event) => onShippingDistrictChange(event.target.value)}
              disabled={!form.shippingProvince || isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingDistrict
                  ? "border-red-400"
                  : "border-gray-200"
              } ${!form.shippingProvince || isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
            >
              <option value="">Chọn Quận / Huyện</option>
              {districts.map((district) => (
                <option key={district.code} value={district.code}>
                  {district.name}
                </option>
              ))}
            </select>
            {formErrors.shippingDistrict ? (
              <p className="text-xs text-red-600">
                {formErrors.shippingDistrict}
              </p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-semibold text-gray-700">Phường / Xã</span>
            <select
              value={form.shippingWard}
              onChange={(event) =>
                onFormFieldChange("shippingWard", event.target.value)
              }
              disabled={!form.shippingDistrict || isProfileSaved}
              className={`w-full rounded-md border px-3 py-2 outline-none focus:border-teal-600 ${
                formErrors.shippingWard ? "border-red-400" : "border-gray-200"
              } ${!form.shippingDistrict || isProfileSaved ? "bg-gray-100 text-gray-500" : ""}`}
            >
              <option value="">Chọn Phường / Xã</option>
              {wards.map((ward) => (
                <option key={ward.code} value={ward.code}>
                  {ward.name}
                </option>
              ))}
            </select>
            {formErrors.shippingWard ? (
              <p className="text-xs text-red-600">{formErrors.shippingWard}</p>
            ) : null}
          </label>
        </div>
      ) : null}
    </div>
  );
}
