import AppLayout from "./AppLayout";
import { Map, MessageSquare, BookOpen, UserCircle, Trophy, HelpCircle, Bell, Radio } from "lucide-react";

const NAV = [
  { to: "/agent", end: true, label: "Painel", icon: Map },
  { to: "/central", label: "Despacho", icon: Radio },
  { to: "/messages", label: "Mensagens", icon: MessageSquare },
  { to: "/training", label: "Capacitação", icon: BookOpen },
  { to: "/profile", label: "Meu Perfil", icon: UserCircle },
  { to: "/achievements", label: "Conquistas", icon: Trophy },
  { to: "/notifications", label: "Notificações", icon: Bell },
  { to: "/manual", label: "Manual", icon: HelpCircle },
];

export default function AgentLayout() {
  return <AppLayout navItems={NAV} roleLabel="Agente" />;
}