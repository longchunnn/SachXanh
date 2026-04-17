bookstore-project/
├── public/                 # File tĩnh (favicon, manifest)
├── src/
│   ├── app/                # Cấu hình lõi (Global Config)
│   │   ├── store.js        # Redux Store + RTK Query Middleware
│   │   ├── rootReducer.js  # Gom các Slice lại
│   │   └── socket.js       # Khởi tạo Socket.io Client (Singleton)
│   │
│   ├── assets/             # Tài nguyên (Static assets)
│   │   ├── images/         # Logo, Banner, Placeholder
│   │   └── styles/         # tailwind.css, antd-custom.css
│   │
│   ├── components/         # Các thành phần giao diện (UI)
│   │   ├── common/         # Button, Input, Loader (tái sử dụng)
│   │   ├── layout/         # Header, Footer, Sidebar (Admin & Client)
│   │   ├── forms/          # LoginForm, ReviewForm, BookForm
│   │   └── guards/         # ProtectedRoute.jsx (Auth/Admin guard)
│   │
│   ├── features/           # LOGIC THEO TÍNH NĂNG (Core Logic)
│   │   ├── auth/
│   │   │   ├── authSlice.js      # Lưu thông tin User & Google Token
│   │   │   └── GoogleLogin.jsx   # Component xử lý OAuth
│   │   ├── cart/
│   │   │   └── cartSlice.js      # Logic giỏ hàng (thêm/bớt/tổng tiền)
│   │   ├── books/
│   │   │   ├── bookApi.js        # RTK Query: Fetch danh sách/chi tiết sách
│   │   │   └── BookCard.jsx      # Component hiển thị từng cuốn sách
│   │   ├── comments/
│   │   │   ├── commentSlice.js   # Quản lý state comment từ Socket
│   │   │   ├── HomeSocketChat.jsx # Bình luận real-time trang chủ
│   │   │   └── ProductReview.jsx  # Đánh giá sách (HTTP)
│   │   └── admin/
│   │       └── adminApi.js       # RTK Query: Quản lý kho, đơn hàng
│   │
│   ├── hooks/              # Custom Hooks tự viết
│   │   ├── useAuth.js      # Lấy thông tin user hiện tại nhanh
│   │   └── useSocket.js    # Hook để emit/listen socket dễ dàng
│   │
│   ├── pages/              # CÁC TRANG (Gắn vào Router)
│   │   ├── client/         # Giao diện người mua
│   │   │   ├── HomePage.jsx
│   │   │   ├── BookDetail.jsx
│   │   │   └── CartPage.jsx
│   │   └── admin/          # Giao diện quản trị (Dashboard)
│   │       ├── Dashboard.jsx
│   │       ├── BookManagement.jsx
│   │       └── OrderManagement.jsx
│   │
│   ├── routes/             # Cấu hình điều hướng
│   │   └── AppRoutes.jsx   # Định nghĩa path '/', '/admin', v.v.
│   │
│   ├── services/           # Cấu hình kết nối API
│   │   └── axiosClient.js  # Instance Axios (BaseURL, Header Auth)
│   │
│   ├── utils/              # Tiện ích (Helper functions)
│   │   ├── constants.js    # Lưu API_URL, SOCKET_URL
│   │   └── formatters.js   # Format giá tiền (VND), ngày tháng
│   │
│   ├── App.jsx             # Nơi bọc Provider (Redux, Antd Config, GoogleAuth)
│   └── main.jsx            # Điểm khởi đầu (Entry point)
│
├── .env                    # Lưu VITE_GOOGLE_CLIENT_ID, API_URL
├── tailwind.config.js      # Cấu hình Tailwind (để đè Antd)
├── vite.config.js          # Cấu hình build dự án
└── package.json            # Danh sách thư viện


bản bổ sung :
src/
 ├── app/
 ├── asset/
 ├── components/
 │    ├── common/       (Các nút bấm, input dùng chung cho cả 2 bên)
 │    └── layouts/
 │         ├── ClientLayout/   (Chứa Header, Footer của web bán sách cũ)
 │         └── AdminLayout/ 🆕 (Chứa Sidebar trái, Topbar riêng cho Admin)
 ├── features/
 │    ├── books/        (Dùng chung)
 │    ├── cart/         (Chỉ client dùng)
 │    ├── session/      (Dùng chung để quản lý đăng nhập)
 │    └── flashSaleAdmin/ 🆕 (Tách riêng logic quản lý Flash Sale Admin ra đây)
 ├── pages/
 │    ├── client/       (👉 BẠN GOM TẤT CẢ CÁC TRANG USER CŨ VÀO ĐÂY)
 │    │    ├── Home.tsx
 │    │    └── Cart.tsx
 │    └── admin/ 🆕     (👉 CÁC TRANG DÀNH CHO ADMIN)
 │         ├── Dashboard.tsx
 │         └── ManageFlashSale.tsx
 ├── routes/
 │    ├── ClientRoutes.tsx (Đường dẫn cho user: /, /cart, /books)
 │    ├── AdminRoutes.tsx 🆕 (Đường dẫn cho admin: /admin, /admin/flash-sale)
 │    └── ProtectedRoute.tsx 🆕 (Bảo vệ: Móc Token ra check xem có ROLE_ADMIN không)
 ├── services/
 │    ├── clientApi.ts
 │    └── adminApi.ts 🆕
 └── utils/