import AppLayout from "./AppLayout";
import { LayoutDashboard, Map, Trophy, MessageSquare, Brain, Shield, HelpCircle, UserCircle, BookOpen, Users } from "lucide-react";

const NAV = [
  { to: "/admin", end: true, label: "Painel Admin", icon: LayoutDashboard },
  { to: "/agent", label: "Central Agente", icon: Map },
  { to: "/citizen", label: "Painel Cidadão", icon: Users },
  { to: "/training", label: "Capacitação", icon: BookOpen },
  { to: "/profile", label: "Perfil Agente", icon: UserCircle },
  { to: "/achievements", label: "Conquistas", icon: Trophy },
  { to: "/messages", label: "Mensagens", icon: MessageSquare },
  { to: "/psych", label: "Psicólogo", icon: Brain },
  { to: "/wanted", label: "Procurados", icon: Shield },
  { to: "/manual", label: "Manual", icon: HelpCircle },
];

export default function AdminLayout() {
  return <AppLayout navItems={NAV} roleLabel="Admin" />;
}