# API Summary (bookstore-frontend)

Tài liệu này tổng hợp **tất cả API/endpoint đang được gọi từ frontend** (đã đối chiếu từ code hiện tại trong `src/services/*` và `src/firebase/*`).

## 1) Cấu hình HTTP chung

**HTTP client:** `src/services/axiosClient.ts` (Axios instance)

- **Base URL**
  - Ưu tiên: `import.meta.env.VITE_API_BASE_URL`
  - Mặc định: `http://localhost:8080/api/v1`
- **Timeout:** 30s
- **Headers mặc định:** `Accept: application/json`, `Content-Type: application/json`
- **Auth (Bearer token):**
  - Frontend tự gắn `Authorization: Bearer <token>` nếu có token hợp lệ.
  - Token lấy từ Redux store (`session.token`) trước, fallback `localStorage["access_token"]`.
  - Nếu token hết hạn hoặc gặp response `401`: frontend tự clear session + các state liên quan (cart/checkout/voucher).

## 2) Chuẩn response mà frontend đang “unwrap”

Frontend chấp nhận **2 kiểu response**:

### 2.1 Envelope (khuyến nghị)

```ts
type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  result?: T;
};
```

- Nếu backend trả `{ result: ... }` thì frontend dùng `result`.
- Nếu backend trả thẳng object/array (không bọc `result`) thì frontend vẫn hoạt động, nhưng **khuyến nghị luôn bọc `result`** để thống nhất.

### 2.2 Paged list

Với các endpoint list, frontend hỗ trợ:

```ts
type PagedResult<T> = {
  content: T[];
  page: number;
  limit: number;
  totalElements: number;
  totalPages: number;
};
```

- Backend có thể trả `ApiEnvelope<PagedResult<T>>` hoặc trả trực tiếp `PagedResult<T>`.
- Ngoài ra frontend cũng chịu được array thuần `T[]`.

## 3) Quy ước query params đang dùng

Nhiều endpoint list đang dùng kiểu paging/sort:

- `_page`: số trang (frontend default `0`)
- `_limit`: số item/trang
- `_sort`: field sort (frontend đang gửi: `orderId`, `bookId`, `userId`, `id`)
- `_order`: `asc | desc`

Một số filter/search:

- `q`: keyword search (books)
- `category_name`: filter theo tên category (books)
- `user_id`: filter orders theo user (staff view)

## 4) REST API (Backend)

> Tất cả path bên dưới là **tương đối** so với `baseURL`.

### 4.1 Auth

| Method | Path             | Hàm frontend                                     | Source                        | Body/Params                                      | Ghi chú |
| ------ | ---------------- | ------------------------------------------------ | ----------------------------- | ------------------------------------------------ | ------------------------------------------ |
| POST   | `/auth/login`    | `loginWithEmailOrUsername(identifier, password)` | `src/services/authService.ts` | Body: `{ username, password }`                   | `identifier` được normalize lowercase/trim |
| POST   | `/auth/register` | `registerAccount(payload)`                       | `src/services/authService.ts` | Body: `{ full_name, username, email, password }` | Field `fullName` được map sang `full_name` |

**Response gợi ý**

- `POST /auth/login`:
  - `result.access_token` (hoặc `result.accessToken`) là JWT
  - `result.user` là user profile

### 4.2 Books

| Method | Path             | Hàm frontend                         | Source                         | Body/Params                                                                    |
| ------ | ---------------- | ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------ |
| GET    | `/books`         | `getBooks()`                         | `src/services/booksService.ts` | Params: `{ _page: 0, _limit: 100 }`                                            |
| GET    | `/books/:bookId` | `getBookById(bookId)`                | `src/services/booksService.ts` | Path param: `bookId` (encodeURIComponent)                                      |
| GET    | `/books`         | `getBooksForStaff(params?)`          | `src/services/booksService.ts` | Params: `{ _page, _limit, q, category_name, _sort: "bookId", _order: "desc" }` |
| POST   | `/books`         | `createBook(payload)`                | `src/services/booksService.ts` | Body: `payload` (Record<string, unknown>)                                      |
| PATCH  | `/books/:bookId` | `updateBookPartial(bookId, payload)` | `src/services/booksService.ts` | Body: `payload` (partial update)                                               |

**Book fields frontend đang dùng (khuyến nghị backend trả):**

`{ id, title, author_name, original_price, selling_price, category_name, cover_image, sold_count, rental_count, total_stock?, description?, long_description?, gallery_images? }`

### 4.3 Categories

| Method | Path                      | Hàm frontend                  | Source                              | Body/Params                                   |
| ------ | ------------------------- | ----------------------------- | ----------------------------------- | --------------------------------------------- |
| GET    | `/categories`             | `getCategories()`             | `src/services/categoriesService.ts` | Params: `{ _page: 0, _limit: 100 }`           |
| GET    | `/categories/:categoryId` | `getCategoryById(categoryId)` | `src/services/categoriesService.ts` | Path param: `categoryId` (encodeURIComponent) |

### 4.4 Orders

| Method | Path               | Hàm frontend                          | Source                          | Body/Params                                                            |
| ------ | ------------------ | ------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/orders`          | `getOrders()`                         | `src/services/ordersService.ts` | Params: `{ _page: 0, _limit: 100, _sort: "orderId", _order: "desc" }`  |
| POST   | `/orders`          | `createOrder(payload)`                | `src/services/ordersService.ts` | Body: `payload` (Record<string, unknown>)                              |
| GET    | `/orders`          | `getOrdersForStaff(params?)`          | `src/services/ordersService.ts` | Params: `{ _page, _limit, _sort: "orderId", _order: "desc", user_id }` |
| PATCH  | `/orders/:orderId` | `updateOrderStatus(orderId, payload)` | `src/services/ordersService.ts` | Body: `{ order_status?, payment_status? }`                             |

**Order fields frontend đang dùng (khuyến nghị backend trả):**

`{ id, user_id, order_date, total_amount, shipping_address, payment_method, order_status, items: [{ book_item_id, title, unit_price, quantity }] }`

### 4.5 Users

| Method | Path             | Hàm frontend                | Source                         | Body/Params                                                  |
| ------ | ---------------- | --------------------------- | ------------------------------ | ------------------------------------------------------------ |
| GET    | `/users/:userId` | `getUserById(userId)`       | `src/services/usersService.ts` | Path param: `userId` (encodeURIComponent)                    |
| GET    | `/users`         | `getUsersForStaff(params?)` | `src/services/usersService.ts` | Params: `{ _page, _limit, _sort: "userId", _order: "desc" }` |

**User fields frontend đang dùng (khuyến nghị backend trả):**

`{ id, username, email, full_name, phone?, role_id?, status? }`

### 4.6 Promotions (Vouchers)

> Frontend đang gọi nhóm voucher admin qua endpoint `/promotions`.

| Method | Path                     | Hàm frontend                               | Source                            | Body/Params                                                      |
| ------ | ------------------------ | ------------------------------------------ | --------------------------------- | ---------------------------------------------------------------- |
| GET    | `/promotions`            | `getVouchers()`                            | `src/services/vouchersService.ts` | Params: `{ _page: 0, _limit: 200, _sort: "id", _order: "desc" }` |
| POST   | `/promotions`            | `createVoucher(payload)`                   | `src/services/vouchersService.ts` | Body: `payload`                                                  |
| PATCH  | `/promotions/:voucherId` | `updateVoucherPartial(voucherId, payload)` | `src/services/vouchersService.ts` | Body: `payload`                                                  |

**Voucher fields frontend đang dùng (khuyến nghị backend trả):**

`{ id, title, subtitle, code, discount_percent, applies_to_categories, voucher_type, condition_text?, valid_from?, valid_to?, terms? }`

### 4.7 Flash Sale (Admin)

| Method | Path                                      | Hàm frontend                           | Source                                  | Body/Params                                                      |
| ------ | ----------------------------------------- | -------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/flash-sale/campaigns`                   | `getCampaigns()`                       | `src/services/flashSaleAdminService.ts` | Params: `{ _page: 0, _limit: 200, _sort: "id", _order: "desc" }` |
| POST   | `/flash-sale/campaigns`                   | `createCampaign(payload)`              | `src/services/flashSaleAdminService.ts` | Body: `payload`                                                  |
| GET    | `/flash-sale/campaigns/:campaignId/items` | `getCampaignItems(campaignId)`         | `src/services/flashSaleAdminService.ts` | Params: `{ _page: 0, _limit: 200, _sort: "id", _order: "desc" }` |
| POST   | `/flash-sale/campaigns/:campaignId/items` | `addCampaignItem(campaignId, payload)` | `src/services/flashSaleAdminService.ts` | Body: `payload`                                                  |

**Campaign fields frontend đang dùng:** `{ id, name, starts_at, ends_at }`

**Campaign item fields frontend đang dùng:** `{ id, campaign_id, book_id, flash_price, flash_stock, purchase_limit }`

### 4.8 Staff Dashboard

| Method | Path                       | Hàm frontend                 | Source                         | Body/Params |
| ------ | -------------------------- | ---------------------------- | ------------------------------ | ----------- |
| GET    | `/staff/dashboard/summary` | `getStaffDashboardSummary()` | `src/services/staffService.ts` | –           |

### 4.9 Support

| Method | Path                             | Hàm frontend                               | Source                           | Body/Params         |
| ------ | -------------------------------- | ------------------------------------------ | -------------------------------- | ------------------- |
| POST   | `/support/open`                  | `openSupportConversation(message)`         | `src/services/supportService.ts` | Body: `{ message }` |
| PATCH  | `/support/:conversationId/close` | `closeSupportConversation(conversationId)` | `src/services/supportService.ts` | –                   |
| POST   | `/support/claim-waiting`         | `claimWaitingConversation()`               | `src/services/supportService.ts` | –                   |

### 4.10 Firebase custom token (Chat)

| Method | Path                     | Hàm frontend                | Source                     | Body/Params | Ghi chú                                                                          |
| ------ | ------------------------ | --------------------------- | -------------------------- | ----------- | -------------------------------------------------------------------------------- |
| GET    | `/firebase/custom-token` | `ensureFirebaseChatLogin()` | `src/firebase/chatAuth.ts` | –           | Backend trả `{ token, uid, primary_role, user_id, full_name }` để login Firebase |

**Gợi ý bảo mật:** endpoint này nên yêu cầu `Authorization: Bearer` để chỉ user đã đăng nhập mới lấy được custom token.

## 5) Firebase (Realtime Chat)

Ngoài REST API, tính năng chat còn dùng **Firebase Auth + Firestore**.

### 5.1 Biến môi trường Firebase

File cấu hình: `src/firebase/client.ts`

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

`firebaseEnabled` chỉ bật khi có đủ các biến tối thiểu (apiKey/authDomain/projectId/appId).

### 5.2 Firestore collections đang dùng
File thao tác chính: `src/firebase/chatService.ts`

- Collection `conversations`
  - Listen theo `where("userUid", "==", uid)` (user)
  - Listen theo `where("staffUid", "==", uid)` (staff)
  - Update các field: `lastMessage`, `lastMessageAt`, `updatedAt`, `unreadByUser`, `unreadByStaff`
- Subcollection `conversations/{conversationId}/messages`
  - Query `orderBy("createdAt", "asc")`
  - Add message doc với: `senderUid`, `senderRole`, `senderName`, `content`, `createdAt`, `read`
- Collection `staff_status`
  - Doc id = `staffUid`
  - Upsert: `setDoc(..., { merge: true })` với `acceptingChats`, `maxLoad`, `currentLoad?`, `lastSeenAt`...

## 6) Error format (khuyến nghị)

Frontend khi gặp lỗi sẽ cố lấy message theo thứ tự:

- Nếu response body là string: dùng string đó
- Nếu response body là object: ưu tiên `message`, fallback `error`

Vì vậy backend nên trả JSON lỗi dạng:

```json
{ "message": "..." }
```

---

Nếu bạn muốn, mình có thể bổ sung thêm cột “Màn hình sử dụng” (page/component nào gọi API nào) bằng cách trace từ các thunk/slice/page hiện tại.
