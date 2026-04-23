import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { isStaffRole } from "../../utils/roles";

export default function RedirectStaffToDashboard() {
  const token = useAppSelector((state) => state.session.token);
  const primaryRole = useAppSelector((state) => state.session.primaryRole);

  if (token && isStaffRole(primaryRole)) {
    return <Navigate to="/staff" replace />;
  }

  return <Outlet />;
}
