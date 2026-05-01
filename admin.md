# Admin API Documentation

Tài liệu này mô tả đầy đủ các API admin backend đang phục vụ frontend.

- **Base URL:** `http://localhost:8081/api/v1`
- **Base URL (frontend đang dùng):** mặc định `http://localhost:8080/api/v1` (xem `VITE_API_BASE_URL` trong FE nếu muốn override)
- **Auth:** `Authorization: Bearer <adminToken>`
- **Response envelope chuẩn:**

```json
{
  "code": 1000,
  "message": "Thanh cong",
  "result": {}
}
```

- **Paged result chuẩn:**

```json
{
  "content": [],
  "page": 0,
  "limit": 20,
  "total_elements": 100,
  "total_pages": 5
}
```

- Frontend hiện tại chủ yếu đọc `content` (các field meta có thể là snake_case hoặc camelCase tuỳ backend).

---

## 1) Auth Admin

### POST `/auth/login`

- **Mục đích:** Đăng nhập tài khoản admin/staff/manager và lấy JWT.
- **Auth:** Không cần.
- **Input body:**

```json
{
  "username": "admin01",
  "password": "Admin@123"
}
```

- **Output chính:** `result.access_token` (hoặc `accessToken`) + `result.user`.
- **Output chính:** `result.access_token` (hoặc `accessToken`) + `result.user`.

**Ghi chú role:**

- Backend có thể trả `primary_role`/`roles` dạng string (`"ADMIN"`, `"ROLE_ADMIN"`, ...) hoặc dạng số (`1/2`).
- Mapping đang dùng ở frontend:
  - `role_id = 1` → `ADMIN`
  - `role_id = 2` → `STAFF`
  - `role_id = 3` → `USER`

---

## 2) Categories Admin

### GET `/categories`

- **Mục đích:** Lấy danh sách category cho màn hình quản trị.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`, `q` (optional).
- **Output:** `ApiResponse<PagedResponse<CategoryResponse>>`.

### GET `/categories/{id}`

- **Mục đích:** Lấy chi tiết category.
- **Path params:** `id` (Long).
- **Output:** `ApiResponse<CategoryResponse>`.

### POST `/categories`

- **Mục đích:** Tạo category mới.
- **Input body:**

```json
{
  "name": "Danh muc moi"
}
```

- **Output:** `ApiResponse<CategoryResponse>`.

### PATCH `/categories/{id}`

- **Mục đích:** Cập nhật category.
- **Input body (partial):**

```json
{
  "name": "Danh muc da cap nhat"
}
```

- **Output:** `ApiResponse<CategoryResponse>`.

---

## 3) Books Admin

### GET `/books`

- **Mục đích:** Lấy danh sách sách cho trang quản trị.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`, `q`, `category_name`.
- **Output:** `ApiResponse<PagedResponse<BookResponse>>`.

### GET `/books/{id}`

- **Mục đích:** Lấy chi tiết sách.
- **Output:** `ApiResponse<BookResponse>`.

### POST `/books`

- **Mục đích:** Tạo sách mới.
- **Input body (mẫu):**

```json
{
  "title": "Sach A",
  "author_name": "Tac gia A",
  "category_name": "Van hoc",
  "original_price": 120000,
  "selling_price": 99000,
  "cover_image": "https://example.com/book.jpg",
  "total_stock": 20,
  "description": "Mo ta"
}
```

- **Output:** `ApiResponse<BookResponse>`.

### PATCH `/books/{id}`

- **Mục đích:** Cập nhật một phần thông tin sách.
- **Input body (partial):**

```json
{
  "selling_price": 89000,
  "total_stock": 25
}
```

- **Output:** `ApiResponse<BookResponse>`.

---

## 4) Users Admin

### GET `/users`

- **Mục đích:** Lấy danh sách người dùng cho staff/admin.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`, `q`.
- **Output:** `ApiResponse<PagedResponse<UserResponse>>`.

### GET `/users/{id}`

- **Mục đích:** Lấy chi tiết một user.
- **Output:** `ApiResponse<UserResponse>`.

---

## 5) Orders Admin

### GET `/orders`

- **Mục đích:** Lấy danh sách đơn hàng phục vụ quản trị.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`, `user_id` (optional).
- **Output:** `ApiResponse<PagedResponse<OrderResponse>>`.

### GET `/orders/{id}`

- **Mục đích:** Lấy chi tiết đơn hàng.
- **Output:** `ApiResponse<OrderResponse>`.

### PATCH `/orders/{id}`

- **Mục đích:** Cập nhật trạng thái đơn hàng/thanh toán.
- **Input body:**

```json
{
  "order_status": "PROCESSING",
  "payment_status": "PAID"
}
```

- **Output:** `ApiResponse<OrderResponse>`.

---

## 6) Promotions Admin

### GET `/promotions`

- **Mục đích:** Lấy danh sách voucher/promotion cho admin.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`.
- **Output:** `ApiResponse<PagedResponse<PromotionResponse>>`.

### POST `/promotions`

- **Mục đích:** Tạo voucher/promotion mới.
- **Input body (mẫu):**

```json
{
  "code": "ADMIN20",
  "discount_percent": 20,
  "min_order_value": 100000,
  "max_discount_amount": 50000,
  "usage_limit": 200,
  "valid_from": "2026-04-23T00:00:00",
  "valid_to": "2026-12-31T23:59:59",
  "status": 1
}
```

- **Output:** `ApiResponse<PromotionResponse>`.

### PATCH `/promotions/{id}`

- **Mục đích:** Cập nhật một phần promotion.
- **Input body (partial):**

```json
{
  "discount_percent": 25,
  "usage_limit": 250
}
```

- **Output:** `ApiResponse<PromotionResponse>`.

---

## 7) Flash Sale Admin

### GET `/flash-sale/campaigns`

- **Mục đích:** Lấy danh sách flash sale campaign.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`.
- **Output:** `ApiResponse<PagedResponse<FlashSaleCampaignResponse>>`.

### POST `/flash-sale/campaigns`

- **Mục đích:** Tạo campaign flash sale.
- **Input body:**

```json
{
  "name": "Flash sale admin test",
  "starts_at": "2026-04-24T09:00:00",
  "ends_at": "2026-04-24T23:59:00",
  "status": "UPCOMING"
}
```

- **Output:** `ApiResponse<FlashSaleCampaignResponse>`.

### GET `/flash-sale/campaigns/{campaignId}/items`

- **Mục đích:** Lấy danh sách item trong campaign.
- **Query params:** `_page`, `_limit`, `_sort`, `_order`.
- **Output:** `ApiResponse<PagedResponse<FlashSaleItemResponse>>`.

### POST `/flash-sale/campaigns/{campaignId}/items`

- **Mục đích:** Thêm item vào campaign flash sale.
- **Input body:**

```json
{
  "book_id": 123,
  "flash_price": 59000,
  "flash_stock": 50,
  "purchase_limit": 2
}
```

- **Output:** `ApiResponse<FlashSaleItemResponse>`.

---

## 8) Support Admin

### POST `/support/claim-waiting`

- **Mục đích:** Staff/admin nhận một cuộc hội thoại đang chờ.
- **Input:** Không body.
- **Output:** `ApiResponse<SupportConversationResponse>` (trong đó có id conversation).

### PATCH `/support/{conversationId}/close`

- **Mục đích:** Đóng hội thoại hỗ trợ.
- **Input:** Path `conversationId`.
- **Output:** `ApiResponse<SupportConversationResponse>`.

---

## 9) Staff Dashboard Admin

### GET `/staff/dashboard/summary`

- **Mục đích:** Lấy dữ liệu tổng quan dashboard của staff/admin.
- **Output:** `ApiResponse<StaffDashboardSummaryResponse>`.

---

## 10) Firebase Admin

### GET `/firebase/custom-token`

- **Mục đích:** Lấy Firebase custom token để staff/admin đăng nhập chat realtime.
- **Output mẫu:**

```json
{
  "code": 1000,
  "message": "Thanh cong",
  "result": {
    "token": "firebase_custom_token",
    "uid": "user_uid",
    "primary_role": "ADMIN",
    "user_id": 1,
    "full_name": "Admin"
  }
}
```

- `primary_role` thực tế có thể là `"ADMIN"` hoặc `1` (tuỳ backend). Frontend đã normalize để chấp nhận cả hai.

---

## Error format

```json
{
  "code": 9102,
  "message": "Ban khong co quyen thuc hien thao tac nay",
  "result": null
}
```

- `401`: thiếu/invalid token
- `403`: không đủ quyền
- `400`: dữ liệu không hợp lệ
- `404`: không tìm thấy tài nguyên
