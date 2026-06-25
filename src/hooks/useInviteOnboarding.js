/**
 * Hook de onboarding de convite.
 * Após o login, verifica se há um invite_token salvo no localStorage
 * (gravado quando o usuário acessou /convite/:token antes de estar logado)
 * e vincula o usuário ao cliente correspondente.
 */
import { useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useInviteOnboarding(user) {
  useEffect(() => {
    if (!user) return;
    if (user.cliente_id) return; // já vinculado

    const token = localStorage.getItem("sentinela_invite_token");
    if (!token) return;

    const apply = async () => {
      try {
        const clientes = await base44.entities.ClienteMunicipal.filter({ invite_token: token });
        if (!clientes || clientes.length === 0) {
          localStorage.removeItem("sentinela_invite_token");
          return;
        }
        const cliente = clientes[0];
        await base44.auth.updateMe({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_municipio,
        });
        localStorage.removeItem("sentinela_invite_token");
      } catch (err) {
        console.error("useInviteOnboarding error:", err);
      }
    };

    apply();
  }, [user?.id]);
}