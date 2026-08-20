import AppLayout from "./AppLayout";
import AgentConsentGate from "./AgentConsentGate";
import { Map, MessageSquare, BookOpen, UserCircle, Trophy, Medal, HelpCircle, Bell, Radio } from "lucide-react";
import { useModulos } from "@/lib/useModulos.jsx";

const ALL_NAV = [
  { to: "/agent", end: true, label: "Painel", icon: Map, modulo: null },
  { to: "/central", label: "Despacho", icon: Radio, modulo: "agente_central_despacho" },
  { to: "/messages", label: "Mensagens", icon: MessageSquare, modulo: null },
  { to: "/training", label: "Capacitação", icon: BookOpen, modulo: "agente_treinamento" },
  { to: "/profile", label: "Meu Perfil", icon: UserCircle, modulo: null },
  { to: "/achievements", label: "Conquistas", icon: Trophy, modulo: null },
  { to: "/ranking", label: "Ranking", icon: Medal, modulo: null },
  { to: "/notifications", label: "Notificações", icon: Bell, modulo: null },
  { to: "/manual", label: "Manual", icon: HelpCircle, modulo: null },
];

export default function AgentLayout() {
  const { hasModulo } = useModulos();
  const navItems = ALL_NAV.filter(item => !item.modulo || hasModulo(item.modulo));
  return (
    <AgentConsentGate>
      <AppLayout navItems={navItems} roleLabel="Agente" />
    </AgentConsentGate>
  );
}