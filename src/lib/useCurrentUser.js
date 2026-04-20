import { useAuth } from "@/lib/AuthContext";

/**
 * Returns effective role for Sentinela app.
 * Uses `user.role` field from customized User entity.
 * Values: 'citizen' | 'agent' | 'admin'
 */
export function useAppRole() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role || "citizen";
}