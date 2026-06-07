import { useAuth } from "@/lib/AuthContext";

/**
 * Returns effective role for Sentinela app.
 * Uses `user.role` field from customized User entity.
 * Values: 'citizen' | 'agent' | 'admin'
 */
export function useAppRole() {
  const { user, isLoadingAuth } = useAuth();
  if (isLoadingAuth || !user) return null;
  return user.role || "citizen";
}