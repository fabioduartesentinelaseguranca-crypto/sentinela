import { useAppRole } from "@/lib/useCurrentUser";
import { AccessDenied as AccessDeniedComponent } from "@/components/shared/RoleGuard";

export default function AccessDeniedPage() {
  const role = useAppRole();
  return <AccessDeniedComponent role={role} />;
}