import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import HomePage from "../pages/HomePage";
import Register from "../pages/Register";
import Login from "../pages/Login";
import SearchPage from "../pages/SearchPage";
import BookDetailPage from "../pages/BookDetailPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import CheckoutOrderPage from "../pages/CheckoutOrderPage";
import AccountPage from "../pages/AccountPage.tsx";
import StaffDashboardPage from "../pages/StaffDashboardPage";
import RequireStaff from "../components/guards/RequireStaff";

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/book/:id" element={<BookDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/:id" element={<CheckoutOrderPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route element={<RequireStaff />}>
          <Route path="/staff" element={<StaffDashboardPage />} />
        </Route>
      </Routes>
    </>
  );
}
