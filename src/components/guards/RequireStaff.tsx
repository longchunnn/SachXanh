import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { isStaffRole } from "../../utils/roles";

export default function RequireStaff() {
  const token = useAppSelector((state) => state.session.token);
  const primaryRole = useAppSelector((state) => state.session.primaryRole);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isStaffRole(primaryRole)) {
    return <Navigate to="/account" replace />;
  }

  return <Outlet />;
}
