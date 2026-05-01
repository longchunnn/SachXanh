import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { hasRole } from "../../utils/roles";

export default function RequireAdmin() {
  const token = useAppSelector((state) => state.session.token);
  const roles = useAppSelector((state) => state.session.roles);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasRole(roles, "ADMIN")) {
    return <Navigate to="/account" replace />;
  }

  return <Outlet />;
}
