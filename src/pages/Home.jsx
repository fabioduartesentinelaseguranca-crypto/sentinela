import { Navigate } from "react-router-dom";
import { useAppRole } from "@/lib/useCurrentUser";

export default function Home() {
  const role = useAppRole();
  if (!role) return null;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "agent") return <Navigate to="/agent" replace />;
  return <Navigate to="/citizen" replace />;
}