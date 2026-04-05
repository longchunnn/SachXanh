import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Flex, Input, Badge } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { getAccessToken } from "../../services/axiosClient";
import { isJwtExpired } from "../../utils/jwt";
import { getCartCount, subscribeCartUpdates } from "../../utils/cart";
import logoImage from "../../asset/logo.jpg";

type HeaderProps = {
  hideSearch?: boolean;
};

export default function Header({ hideSearch = false }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [cartCount, setCartCount] = useState(0);

  const isCartPage = location.pathname.startsWith("/cart");
  const displayCartCount = isAuthenticated ? cartCount : 0;

  useEffect(() => {
    const syncAuthState = () => {
      const token = getAccessToken();
      setIsAuthenticated(Boolean(token && !isJwtExpired(token)));
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  useEffect(() => {
    const syncCartCount = () => setCartCount(getCartCount());
    syncCartCount();
    const unsubscribe = subscribeCartUpdates(syncCartCount);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search).get("q") ?? "";
    setSearchInput((prev) => (prev === query ? prev : query));
  }, [location.search]);

  const navigateBySearch = (rawKeyword: string) => {
    const keyword = rawKeyword.trim();

    if (!keyword) {
      if (isCartPage) {
        const cartTarget = "/cart";
        if (`${location.pathname}${location.search}` !== cartTarget) {
          navigate(cartTarget);
        }
        return;
      }

      if (location.pathname.startsWith("/search")) {
        return;
      }
      return;
    }

    const target = `${isCartPage ? "/cart" : "/search"}?q=${encodeURIComponent(keyword)}`;

    if (`${location.pathname}${location.search}` !== target) {
      navigate(target);
    }
  };

  // Debounce search - 500ms delay before navigating
  useEffect(() => {
    const timer = setTimeout(() => {
      navigateBySearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, isCartPage]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      navigateBySearch(searchInput);
    }
  };

  return (
    // 1. LỚP VỎ NGOÀI CÙNG: Trải dài 100% màn hình, chứa nền trắng và đổ bóng.
    // Thêm flex và justify-center để nội dung bên trong tự động chui vào giữa.
    <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 flex justify-center h-20">
      {/* 2. LỚP LÕI BÊN TRONG: Khống chế chiều rộng tối đa bằng max-w-7xl */}
      <Flex
        align="center"
        justify="space-between"
        className="w-full max-w-7xl px-4 md:px-8"
      >
        {/* LOGO: Sách Xanh */}
        <Link to="/" className="inline-flex items-center">
          <img
            src={logoImage}
            alt="Sách Xanh"
            className="h-14 w-auto object-contain md:h-16"
          />
        </Link>

        {/* THANH TÌM KIẾM */}
        {!hideSearch ? (
          <div className="w-full max-w-xl hidden md:block">
            <Input
              size="large"
              placeholder={
                isCartPage
                  ? "Tìm kiếm trong giỏ hàng..."
                  : "Tìm kiếm sách, tác giả, văn phòng phẩm..."
              }
              prefix={<SearchOutlined className="text-gray-400 mr-2" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
              className="
                rounded-full px-6 py-2 bg-gray-50
                hover:border-teal-700! 
                focus-within:border-teal-700! 
                focus-within:bg-white!
                focus-within:shadow-[0_0_0_2px_rgba(15,118,110,0.2)]!
              "
            />
          </div>
        ) : (
          <div className="hidden md:block md:flex-1" />
        )}

        {/* ICON GIỎ HÀNG & PROFILE */}
        <Flex align="center" gap={20}>
          {!isAuthenticated ? (
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700! transition-colors hover:bg-teal-700 hover:text-white!"
            >
              Đăng nhập
            </Link>
          ) : null}

          <Link to="/cart" className="cursor-pointer group">
            <Badge
              count={displayCartCount}
              color="#115e59"
              offset={[-4, 6]}
              className="group-hover:scale-110 transition-transform"
            >
              <ShoppingCartOutlined className="text-[32px] text-teal-800! group-hover:text-teal-600! transition-colors" />
            </Badge>
          </Link>

          <Link to="/account" className="cursor-pointer group">
            <UserOutlined className="text-[30px] text-teal-800! group-hover:text-teal-600! transition-colors" />
          </Link>
        </Flex>
      </Flex>
    </div>
  );
}
