import AppLayout from "./AppLayout";
import AgentConsentGate from "./AgentConsentGate";
import { LayoutDashboard, Trophy, MessageSquare, Shield, HelpCircle, BookOpen, Bell, Radio } from "lucide-react";
import { useModulos } from "@/lib/useModulos.jsx";

const ALL_NAV = [
  { to: "/admin", end: true, label: "Painel Admin", icon: LayoutDashboard, modulo: null },
  { to: "/central", label: "Despacho", icon: Radio, modulo: "agente_central_despacho" },
  { to: "/training", label: "Capacitação", icon: BookOpen, modulo: "agente_treinamento" },
  { to: "/achievements", label: "Conquistas", icon: Trophy, modulo: null },
  { to: "/messages", label: "Mensagens", icon: MessageSquare, modulo: null },
  { to: "/wanted", label: "Procurados", icon: Shield, modulo: "gestao_procurados" },
  { to: "/notifications", label: "Notificações", icon: Bell, modulo: null },
  { to: "/manual", label: "Manual", icon: HelpCircle, modulo: null },
];

export default function AdminLayout() {
  const { hasModulo } = useModulos();
  const navItems = ALL_NAV.filter(item => !item.modulo || hasModulo(item.modulo));
  return (
    <AgentConsentGate>
      <AppLayout navItems={navItems} roleLabel="Admin" />
    </AgentConsentGate>
  );
}