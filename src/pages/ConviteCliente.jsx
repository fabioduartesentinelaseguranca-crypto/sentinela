import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Página de convite por token.
 * URL: /convite/:token
 *
 * Fluxo:
 * 1. Usuário acessa o link /convite/lins-sp-xxxxx
 * 2. Se não logado → salva o token no localStorage e redireciona para login
 * 3. Após login, retorna a esta página (ou o onboarding detecta e aplica)
 * 4. Busca o ClienteMunicipal pelo invite_token
 * 5. Vincula o usuário ao cliente via base44.auth.updateMe
 * 6. Redireciona para o app
 */
export default function ConviteCliente() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | applying | success | error | already_linked
  const [clienteNome, setClienteNome] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (token) {
      localStorage.setItem("sentinela_invite_token", token);
    }
    processarConvite();
  }, [token]);

  const processarConvite = async () => {
    try {
      // Verificar se está autenticado
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        // Salva token e redireciona para login; após login o usuario volta aqui
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      const user = await base44.auth.me();

      // Se já tem cliente vinculado, não sobrescrever
      if (user.cliente_id) {
        setClienteNome(user.cliente_nome || "seu município");
        setStatus("already_linked");
        return;
      }

      setStatus("applying");

      // Buscar cliente pelo token
      const clientes = await base44.entities.ClienteMunicipal.filter({ invite_token: token });
      if (!clientes || clientes.length === 0) {
        setStatus("error");
        setErrorMsg("Link de convite inválido ou expirado.");
        return;
      }

      const cliente = clientes[0];
      setClienteNome(cliente.nome_municipio);

      // Vincular usuário ao cliente
      await base44.auth.updateMe({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_municipio,
      });

      // Limpar token salvo
      localStorage.removeItem("sentinela_invite_token");

      setStatus("success");

      // Redirecionar após 2s
      setTimeout(() => navigate("/", { replace: true }), 2000);

    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg("Ocorreu um erro ao processar o convite. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-border/60 bg-card p-8 text-center space-y-5 shadow-xl">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold">Sentinela Segurança Cidadã</h1>
          <p className="text-sm text-muted-foreground mt-1">Convite de acesso ao sistema</p>
        </div>

        {(status === "loading" || status === "applying") && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              {status === "loading" ? "Verificando convite..." : "Vinculando sua conta ao município..."}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
            <div>
              <p className="font-semibold text-success">Conta vinculada com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você agora faz parte do município <strong>{clienteNome}</strong>.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Redirecionando...</p>
          </div>
        )}

        {status === "already_linked" && (
          <div className="space-y-3">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <div>
              <p className="font-semibold">Conta já vinculada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você já está no contrato de <strong>{clienteNome}</strong>.
              </p>
            </div>
            <Button onClick={() => navigate("/", { replace: true })} className="w-full">
              Ir para o App
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <div>
              <p className="font-semibold text-destructive">Erro no convite</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/", { replace: true })} className="w-full">
              Ir para o App
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}