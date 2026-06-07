import { useAppRole } from "@/lib/useCurrentUser";
import { Navigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";

// 403 Page
export function AccessDenied({ role }) {
  const home = role === "citizen" ? "/citizen" : role === "agent" ? "/agent" : role === "admin" ? "/admin" : role === "psychologist" ? "/psych" : "/";
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-md">
        <ShieldX className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-3xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        <p className="text-xs text-muted-foreground">Erro 403 — Acesso proibido para o perfil <strong>{role || "desconhecido"}</strong>.</p>
        <Link to={home} className="inline-block mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Voltar ao meu painel
        </Link>
      </div>
    </div>
  );
}

export default function RoleGuard({ allow, children }) {
  const role = useAppRole();
  // Still loading auth — wait before deciding access
  if (!role) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (allow.includes(role)) return children;
  return <AccessDenied role={role} />;
}