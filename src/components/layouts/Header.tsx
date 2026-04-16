import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Flex, Input, Badge } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAppSelector } from "../../app/hooks";
import logoImage from "../../asset/logo.jpg";
import { isStaffRole } from "../../utils/roles";

type HeaderProps = {
  hideSearch?: boolean;
};

type SearchBarProps = {
  isCartPage: boolean;
  pathname: string;
  search: string;
};

function SearchBar({ isCartPage, pathname, search }: SearchBarProps) {
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(search).get("q") ?? "";
  const [searchInput, setSearchInput] = useState(initialQuery);

  const navigateBySearch = useCallback(
    (rawKeyword: string) => {
      const keyword = rawKeyword.trim();

      if (!keyword) {
        if (isCartPage) {
          const cartTarget = "/cart";
          if (`${pathname}${search}` !== cartTarget) {
            navigate(cartTarget);
          }
          return;
        }

        if (pathname.startsWith("/search")) {
          return;
        }
        return;
      }

      const target = `${isCartPage ? "/cart" : "/search"}?q=${encodeURIComponent(keyword)}`;

      if (`${pathname}${search}` !== target) {
        navigate(target);
      }
    },
    [isCartPage, navigate, pathname, search],
  );

  // Debounce search - 500ms delay before navigating
  useEffect(() => {
    const timer = setTimeout(() => {
      navigateBySearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [navigateBySearch, searchInput]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      navigateBySearch(searchInput);
    }
  };

  const handleResetSearch = () => {
    setSearchInput("");

    if (isCartPage) {
      navigate("/cart");
      return;
    }

    if (pathname.startsWith("/search")) {
      navigate("/search");
    }
  };

  return (
    <div className="hidden w-full max-w-xl items-center gap-2 md:flex">
      <div className="flex-1">
        <Input
          size="large"
          placeholder={
            isCartPage
              ? "Tìm kiếm trong giỏ hàng..."
              : "Tìm kiếm sách, tác giả, văn phòng phẩm..."
          }
          prefix={<SearchOutlined className="mr-2 text-gray-400" />}
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

      <button
        type="button"
        onClick={handleResetSearch}
        aria-label="Reset tìm kiếm"
        title="Reset tìm kiếm"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-teal-600 hover:bg-teal-50 hover:text-teal-700"
      >
        <SearchOutlined />
      </button>
    </div>
  );
}

export default function Header({ hideSearch = false }: HeaderProps) {
  const location = useLocation();
  const isAuthenticated = useAppSelector((state) =>
    Boolean(state.session.token),
  );
  const cartCount = useAppSelector((state) =>
    state.cart.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const isCartPage = location.pathname.startsWith("/cart");
  const primaryRole = useAppSelector((state) => state.session.primaryRole);
  const displayCartCount = isAuthenticated ? cartCount : 0;
  const showStaffButton = isAuthenticated && isStaffRole(primaryRole);

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 flex justify-center h-20">
      {/* 2. LỚP LÕI BÊN TRONG: Khống chế chiều rộng tối đa bằng max-w-7xl */}
      <Flex
        align="center"
        justify="space-between"
        className="w-full max-w-7xl px-4 md:px-8"
      >
        <Link to="/" className="inline-flex items-center">
          <img
            src={logoImage}
            alt="Sách Xanh"
            className="h-14 w-auto object-contain md:h-16"
          />
        </Link>

        {/* THANH TÌM KIẾM */}
        {!hideSearch ? (
          <SearchBar
            key={`${location.pathname}${location.search}`}
            isCartPage={isCartPage}
            pathname={location.pathname}
            search={location.search}
          />
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

          {showStaffButton ? (
            <Link
              to="/staff"
              className="hidden rounded-full border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 md:inline-flex"
            >
              Staff
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
