import { useAppRole } from "@/lib/useCurrentUser";
import { Navigate } from "react-router-dom";

export default function RoleGuard({ allow, children }) {
  const role = useAppRole();
  if (!role) return null;
  if (!allow.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}