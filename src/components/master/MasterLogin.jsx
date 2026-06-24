import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/shared/Logo";

export default function MasterLogin({ onLogin }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise(r => setTimeout(r, 600));
    const ok = onLogin(password);
    if (!ok) setError("Senha mestra incorreta.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Painel Master</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Acesso restrito — Gestão de Clientes e Módulos Sentinela
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Senha mestra"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? "Verificando..." : "Acessar Painel Master"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Este painel é exclusivo para administradores da plataforma Sentinela.
          </p>
        </div>
      </div>
    </div>
  );
}