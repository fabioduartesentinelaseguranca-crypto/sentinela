import AppLayout from "./AppLayout";
import { Map, MessageSquare, BookOpen, UserCircle, Trophy, HelpCircle, Bell } from "lucide-react";

const NAV = [
  { to: "/agent", end: true, label: "Central", icon: Map },
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